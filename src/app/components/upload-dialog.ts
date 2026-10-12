import {
	Component,
	DestroyRef,
	ElementRef,
	HostListener,
	afterNextRender,
	effect,
	inject,
	input,
	output,
	signal,
	untracked,
	viewChild,
} from '@angular/core';
import { isCancel } from 'axios';
import { classifyS3Error } from '../helpers/errors';
import { formatBytes, messageForError } from '../helpers/format';
import { S3ErrorKind } from '../models/bucket';
import { DEMO_MODE } from '../demo/demo';
import { BucketService } from '../services/bucket.service';
import { I18nService } from '../services/i18n.service';
import { Icon } from './icon';

type RowStatus = 'checking' | 'conflict' | 'ready' | 'uploading' | 'done' | 'error';
type RowError = S3ErrorKind | 'badName' | 'demo';
type Clash = 'folder' | 'queue' | null;

interface UploadItem {
	id: string;
	file: File;
	prefix: string;
	name: string;
	originalName: string;
	status: RowStatus;
	error: RowError | null;
	progress: number;
	clash: Clash;
}

@Component({
	selector: 'app-upload-dialog',
	imports: [Icon],
	templateUrl: './upload-dialog.html',
})
export class UploadDialog {
	readonly prefix = input.required<string>();
	readonly batch = input(0);
	readonly files = input<File[]>([]);
	readonly dropping = input(false);
	readonly closed = output<void>();
	readonly uploaded = output<void>();

	private readonly demo = inject(DEMO_MODE, { optional: true }) === true;
	protected readonly i18n = inject(I18nService);
	protected readonly formatBytes = formatBytes;
	protected readonly messageForError = messageForError;
	protected readonly items = signal<UploadItem[]>([]);
	private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
	private readonly bucket = inject(BucketService);
	private readonly claimed = new Set<string>();
	private readonly started = new Set<string>();
	private readonly controllers = new Set<AbortController>();
	private seenBatch = 0;
	private active = 0;
	private notified = 0;
	private dead = false;

	constructor() {
		afterNextRender(() => this.panel()?.nativeElement.focus());
		inject(DestroyRef).onDestroy(() => {
			this.dead = true;
			for (const controller of this.controllers) controller.abort();
		});
		effect(() => {
			const batch = this.batch();
			const files = this.files();
			if (!batch || batch === this.seenBatch) return;
			this.seenBatch = batch;
			untracked(() => this.enqueue(files));
		});
	}

	@HostListener('document:keydown.escape')
	protected onEscape(): void {
		this.requestClose();
	}

	protected location(): string {
		return this.prefix().replace(/\/$/, '') || '/';
	}

	protected busy(): boolean {
		return this.items().some(
			(item) =>
				item.status === 'checking' ||
				item.status === 'ready' ||
				item.status === 'uploading',
		);
	}

	protected requestClose(): void {
		if (this.busy()) return;
		this.closed.emit();
	}

	protected onPick(event: Event): void {
		if (!(event.target instanceof HTMLInputElement)) return;
		this.enqueue([...(event.target.files ?? [])]);
		event.target.value = '';
	}

	protected replace(id: string): void {
		const item = this.find(id);
		if (!item || item.status !== 'conflict') return;
		this.claimed.add(item.name);
		this.patch(id, { status: 'ready' });
		this.pump();
	}

	protected beside(id: string): void {
		const item = this.find(id);
		if (!item || item.status !== 'conflict') return;
		this.patch(id, { status: 'checking', error: null });
		void this.placeBeside(item);
	}

	protected retry(id: string): void {
		const item = this.find(id);
		if (!item || item.status !== 'error' || item.error === 'badName' || item.error === 'demo') return;
		this.started.delete(id);
		this.claimed.add(item.name);
		this.patch(id, { status: 'checking', error: null, progress: 0 });
		void this.inspect(id);
	}

	protected rowError(item: UploadItem): string {
		if (item.error === 'badName') return this.i18n.t().uploadBadName;
		if (item.error === 'demo') return this.i18n.t().uploadDemo;
		if (item.error === 'forbidden') return this.i18n.t().uploadForbidden;
		return item.error ? messageForError(item.error, this.i18n.t()) : '';
	}

	private enqueue(files: File[]): void {
		const prefix = this.prefix();
		const next: UploadItem[] = [];
		for (const file of files) {
			const original = safeFileName(file.name);
			const id = crypto.randomUUID();
			if (!original) {
				next.push({
					id,
					file,
					prefix,
					name: file.name || '—',
					originalName: file.name || '—',
					status: 'error',
					error: 'badName',
					progress: 0,
					clash: null,
				});
				continue;
			}
			const queued = this.claimed.has(original);
			if (!queued) this.claimed.add(original);
			next.push({
				id,
				file,
				prefix,
				name: original,
				originalName: original,
				status: queued ? 'conflict' : 'checking',
				error: null,
				progress: 0,
				clash: queued ? 'queue' : null,
			});
		}
		if (!next.length) return;
		this.items.update((list) => [...list, ...next]);
		for (const item of next) {
			if (item.status === 'checking') void this.inspect(item.id);
		}
	}

	private async inspect(id: string): Promise<void> {
		const item = this.find(id);
		if (!item) return;
		try {
			const exists = await this.bucket.exists(`${item.prefix}${item.name}`);
			if (this.dead) return;
			const current = this.find(id);
			if (!current || current.status !== 'checking') return;
			if (exists) this.patch(id, { status: 'conflict', clash: 'folder' });
			else {
				this.patch(id, { status: 'ready' });
				this.pump();
			}
		} catch (error) {
			if (this.dead) return;
			const current = this.find(id);
			if (!current || current.status !== 'checking') return;
			this.patch(id, { status: 'error', error: classifyS3Error(error).kind });
		} finally {
			this.notify();
		}
	}

	private async placeBeside(item: UploadItem): Promise<void> {
		try {
			const name = await this.freeName(item);
			if (this.dead || this.find(item.id)?.status !== 'checking') return;
			this.claimed.add(name);
			this.patch(item.id, { name, status: 'ready', clash: null });
			this.pump();
		} catch (error) {
			if (this.dead) return;
			const kind = error instanceof NameError ? 'badName' : classifyS3Error(error).kind;
			this.patch(item.id, { status: 'error', error: kind });
		} finally {
			this.notify();
		}
	}

	private async freeName(item: UploadItem): Promise<string> {
		const source = item.originalName;
		const dot = source.lastIndexOf('.');
		const base = dot > 0 ? source.slice(0, dot) : source;
		const ext = dot > 0 ? source.slice(dot) : '';
		for (let index = 2; index < 500; index += 1) {
			const candidate = `${base} (${index})${ext}`;
			if (this.claimed.has(candidate)) continue;
			const key = `${item.prefix}${candidate}`;
			if (key.length > 1024) break;
			if (await this.bucket.exists(key)) continue;
			return candidate;
		}
		throw new NameError();
	}

	private pump(): void {
		if (this.dead) return;
		for (const item of this.items()) {
			if (this.active >= 2) return;
			if (item.status !== 'ready' || this.started.has(item.id)) continue;
			this.started.add(item.id);
			this.active += 1;
			this.patch(item.id, { status: 'uploading', progress: 0 });
			void this.send(item).finally(() => {
				this.active -= 1;
				this.pump();
				this.notify();
			});
		}
	}

	private async send(item: UploadItem): Promise<void> {
		if (this.demo) {
			this.patch(item.id, { status: 'error', error: 'demo', progress: 0 });
			return;
		}
		const controller = new AbortController();
		this.controllers.add(controller);
		try {
			await this.bucket.upload(
				`${item.prefix}${item.name}`,
				item.file,
				(loaded, total) => {
					const progress =
						total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
					this.patch(item.id, { progress });
				},
				controller.signal,
			);
			if (controller.signal.aborted || this.dead) return;
			this.patch(item.id, { status: 'done', progress: 100, error: null });
		} catch (error) {
			if (controller.signal.aborted || isCancel(error) || this.dead) return;
			this.started.delete(item.id);
			this.patch(item.id, {
				status: 'error',
				error: classifyS3Error(error).kind,
				progress: 0,
			});
		} finally {
			this.controllers.delete(controller);
		}
	}

	private notify(): void {
		if (this.dead || this.busy()) return;
		const done = this.items().filter((item) => item.status === 'done').length;
		if (!done || done === this.notified) return;
		this.notified = done;
		this.uploaded.emit();
	}

	private find(id: string): UploadItem | undefined {
		return this.items().find((item) => item.id === id);
	}

	private patch(id: string, partial: Partial<UploadItem>): void {
		this.items.update((list) =>
			list.map((item) => (item.id === id ? { ...item, ...partial } : item)),
		);
	}
}

class NameError extends Error {
	constructor() {
		super('name');
		this.name = 'NameError';
	}
}

function safeFileName(name: string): string | null {
	const trimmed = name.trim();
	if (!trimmed || trimmed.length > 240) return null;
	if (/[\\/\0]/.test(trimmed) || trimmed === '.' || trimmed === '..') return null;
	return trimmed;
}
