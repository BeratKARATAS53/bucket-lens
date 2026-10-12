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
import { classifyS3Error } from '../helpers/errors';
import {
	extensionOf,
	formatBytes,
	formatDate,
	formatExact,
	kindLabel,
	messageForError,
} from '../helpers/format';
import { objectUrl } from '../helpers/regions';
import { BucketEntry, ObjectMeta, S3ErrorKind } from '../models/bucket';
import { BucketService } from '../services/bucket.service';
import { DownloadNotice } from '../services/download-notice';
import { ConnectionService } from '../services/connection.service';
import { I18nService } from '../services/i18n.service';
import { iconForEntry, Icon } from './icon';
import { DEMO_MODE } from '../demo/demo';

@Component({
	selector: 'app-detail-dialog',
	imports: [Icon],
	templateUrl: './detail-dialog.html',
})
export class DetailDialog {
	readonly entry = input.required<BucketEntry>();
	readonly closed = output<void>();

	protected readonly demo = inject(DEMO_MODE, { optional: true }) === true;
	protected readonly i18n = inject(I18nService);
	protected readonly iconFor = iconForEntry;
	protected readonly extensionOf = extensionOf;
	protected readonly formatBytes = formatBytes;
	protected readonly formatExact = formatExact;
	protected readonly formatDate = formatDate;
	protected readonly kindLabel = kindLabel;
	protected readonly messageForError = messageForError;

	private readonly bucket = inject(BucketService);
	private readonly notice = inject(DownloadNotice);
	private readonly store = inject(ConnectionService);
	private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
	private readonly presignRoot = viewChild<ElementRef<HTMLElement>>('presignRoot');
	private copyTimer = 0;
	private presignTimer = 0;

	protected readonly durations = [5, 10, 15, 30, 60, 90, 120] as const;
	protected readonly meta = signal<ObjectMeta | null>(null);
	protected readonly metaReady = signal(false);
	protected readonly downloading = signal(false);
	protected readonly downloadError = signal<S3ErrorKind | null>(null);
	protected readonly copied = signal(false);
	protected readonly copyFailed = signal(false);
	protected readonly presignOpen = signal(false);
	protected readonly presignFor = signal<(typeof this.durations)[number]>(60);
	protected readonly presigning = signal(false);
	protected readonly presignUrl = signal<string | null>(null);
	protected readonly presignError = signal<S3ErrorKind | null>(null);
	protected readonly presignCopied = signal(false);
	protected readonly presignFailed = signal(false);
	protected readonly presignDemo = signal(false);

	constructor() {
		const destroyRef = inject(DestroyRef);
		let alive = true;
		let request = 0;
		destroyRef.onDestroy(() => {
			alive = false;
			clearTimeout(this.copyTimer);
			clearTimeout(this.presignTimer);
		});
		afterNextRender(() => this.panel()?.nativeElement.focus());
		effect(() => {
			this.entry();
			untracked(() => this.resetCopy());
		});
		effect(() => {
			const entry = this.entry();
			const current = ++request;
			this.metaReady.set(false);
			void this.bucket.meta(entry.key).then(
				(meta) => {
					if (!alive || current !== request) return;
					this.meta.set(meta);
					this.metaReady.set(true);
				},
				() => {
					if (!alive || current !== request) return;
					this.meta.set(null);
					this.metaReady.set(true);
				},
			);
		});
	}

	@HostListener('document:keydown.escape')
	protected onEscape(): void {
		if (this.presignOpen()) {
			this.presignOpen.set(false);
			return;
		}
		this.closed.emit();
	}

	@HostListener('document:click', ['$event'])
	protected onDocumentClick(event: MouseEvent): void {
		if (!this.presignOpen()) return;
		const root = this.presignRoot()?.nativeElement;
		if (event.target instanceof Node && root?.contains(event.target)) return;
		this.presignOpen.set(false);
	}

	protected isFtp(): boolean {
		return this.store.config()?.provider === 'ftp';
	}

	protected contentType(): string | null {
		return this.meta()?.contentType ?? null;
	}

	protected size(): number | null {
		return this.meta()?.size ?? this.entry().size;
	}

	protected modified(): string | null {
		return this.meta()?.lastModified ?? this.entry().lastModified;
	}

	protected storageClass(): string | null {
		return this.meta()?.storageClass ?? this.entry().storageClass;
	}

	protected etag(): string | null {
		return this.meta()?.etag ?? this.entry().etag;
	}

	protected address(): string {
		const connection = this.store.config();
		return connection ? objectUrl(connection, this.entry().key) : this.entry().key;
	}

	protected async copyPath(): Promise<void> {
		await this.copyText(this.address(), 'path');
	}

	protected togglePresign(): void {
		this.presignOpen.update((open) => !open);
	}

	protected pickDuration(minutes: (typeof this.durations)[number]): void {
		if (this.presignFor() === minutes) return;
		this.presignFor.set(minutes);
		this.presignUrl.set(null);
		this.presignError.set(null);
		this.presignCopied.set(false);
		this.presignFailed.set(false);
		this.presignDemo.set(false);
		clearTimeout(this.presignTimer);
	}

	protected presignReady(): string {
		return this.i18n.t().presignReady.replace('{minutes}', String(this.presignFor()));
	}

	protected async createPresign(event: Event): Promise<void> {
		event.preventDefault();
		if (this.presigning()) return;
		this.presignDemo.set(false);
		this.presignError.set(null);
		this.presignCopied.set(false);
		if (this.demo) {
			this.presignUrl.set(null);
			this.presignDemo.set(true);
			return;
		}
		this.presigning.set(true);
		try {
			const link = await this.bucket.presign(this.entry().key, this.presignFor());
			this.presignUrl.set(link.url);
		} catch (error) {
			this.presignUrl.set(null);
			this.presignError.set(classifyS3Error(error).kind);
		} finally {
			this.presigning.set(false);
		}
	}

	protected async copyPresign(): Promise<void> {
		const url = this.presignUrl();
		if (!url) return;
		await this.copyText(url, 'link');
	}

	private resetCopy(): void {
		this.copied.set(false);
		this.copyFailed.set(false);
		this.presignOpen.set(false);
		this.presignUrl.set(null);
		this.presignError.set(null);
		this.presignCopied.set(false);
		this.presignFailed.set(false);
		this.presignDemo.set(false);
		clearTimeout(this.copyTimer);
		clearTimeout(this.presignTimer);
	}

	private async copyText(value: string, which: 'path' | 'link'): Promise<void> {
		const copied = which === 'path' ? this.copied : this.presignCopied;
		const failed = which === 'path' ? this.copyFailed : this.presignFailed;
		try {
			await navigator.clipboard.writeText(value);
			copied.set(true);
			failed.set(false);
		} catch {
			copied.set(false);
			failed.set(true);
		}
		const timer = which === 'path' ? this.copyTimer : this.presignTimer;
		clearTimeout(timer);
		const next = window.setTimeout(() => {
			copied.set(false);
			failed.set(false);
		}, 5000);
		if (which === 'path') this.copyTimer = next;
		else this.presignTimer = next;
	}

	protected downloadBusy(): boolean {
		return this.downloading() || this.notice.busy();
	}

	protected async download(): Promise<void> {
		if (this.downloadBusy()) return;
		this.downloading.set(true);
		this.downloadError.set(null);
		try {
			await this.notice.save(this.entry().key, this.entry().name, this.size());
		} catch (error) {
			this.downloadError.set(classifyS3Error(error).kind);
		} finally {
			this.downloading.set(false);
		}
	}
}
