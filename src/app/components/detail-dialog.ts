import {
	Component,
	DestroyRef,
	ElementRef,
	HostListener,
	Injector,
	afterNextRender,
	effect,
	inject,
	input,
	output,
	signal,
	untracked,
	viewChild,
} from '@angular/core';
import { isAxiosError } from 'axios';
import { classifyS3Error } from '../helpers/errors';
import {
	extensionOf,
	formatBytes,
	formatDate,
	formatExact,
	kindLabel,
	messageForError,
} from '../helpers/format';
import { connectionTitle, objectUrl, providerLabelKey } from '../helpers/regions';
import { BucketEntry, ConnectionView, ObjectMeta, S3ErrorKind } from '../models/bucket';
import { BucketService, COPY_LIMIT_BYTES } from '../services/bucket.service';
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
	private readonly injector = inject(Injector);
	private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
	private readonly presignRoot = viewChild<ElementRef<HTMLElement>>('presignRoot');
	private readonly presignForm = viewChild<ElementRef<HTMLElement>>('presignForm');
	private readonly presignFeedback = viewChild<ElementRef<HTMLElement>>('presignFeedback');
	private readonly copyForm = viewChild<ElementRef<HTMLElement>>('copyForm');
	private readonly copyFeedback = viewChild<ElementRef<HTMLElement>>('copyFeedback');
	private copyTimer = 0;
	private presignTimer = 0;
	private copyTicket = 0;
	private copyJob: string | null = null;
	private copyHeld = false;

	protected readonly durations = [5, 10, 15, 30, 60, 90, 120] as const;
	protected readonly meta = signal<ObjectMeta | null>(null);
	protected readonly metaReady = signal(false);
	protected readonly downloading = signal(false);
	protected readonly downloadError = signal<S3ErrorKind | null>(null);
	protected readonly downloadDemo = signal(false);
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
	protected readonly copyOpen = signal(false);
	protected readonly copyTarget = signal('');
	protected readonly copyPathText = signal('');
	protected readonly copying = signal(false);
	protected readonly copyLoaded = signal(0);
	protected readonly copyTotal = signal(0);
	protected readonly copyError = signal<string | null>(null);
	protected readonly copyExists = signal(false);
	protected readonly copyDone = signal(false);
	protected readonly copyDemo = signal(false);

	constructor() {
		const destroyRef = inject(DestroyRef);
		let alive = true;
		let request = 0;
		destroyRef.onDestroy(() => {
			alive = false;
			clearTimeout(this.copyTimer);
			clearTimeout(this.presignTimer);
			this.stopCopyJob(false);
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
		if (this.copying()) return;
		if (this.copyOpen()) {
			this.copyOpen.set(false);
			return;
		}
		if (this.presignOpen()) {
			this.presignOpen.set(false);
			return;
		}

		this.closed.emit();
	}

	protected requestClose(): void {
		if (this.copying()) return;

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

	protected destinations(): ConnectionView[] {
		const active = this.store.config()?.id;
		return this.store.connections().filter((item) => item.id !== active);
	}

	protected destinationLabel(item: ConnectionView): string {
		const t = this.i18n.t();
		return `${connectionTitle(item)} · ${t[providerLabelKey(item.provider)]}`;
	}

	protected copyBlocked(): 'large' | 'unknown' | null {
		const size = this.size();
		if (size == null) return this.metaReady() ? 'unknown' : null;
		if (size > COPY_LIMIT_BYTES) return 'large';

		return null;
	}

	protected copyPercent(): number {
		const total = this.copyTotal();
		if (total <= 0) return 0;

		return Math.min(100, Math.round((this.copyLoaded() / total) * 100));
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
		if (this.presignOpen()) this.reveal(this.presignForm);
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
			this.reveal(this.presignFeedback);
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
			if (this.presignUrl() || this.presignError()) this.reveal(this.presignFeedback);
		}
	}

	private reveal(target: () => ElementRef<HTMLElement> | undefined): void {
		afterNextRender(
			() => {
				this.scrollIntoPanel(target()?.nativeElement);
			},
			{ injector: this.injector },
		);
	}

	private scrollIntoPanel(element: HTMLElement | undefined): void {
		const panel = this.panel()?.nativeElement;
		if (!panel || !element) return;

		const panelRect = panel.getBoundingClientRect();
		const rect = element.getBoundingClientRect();
		const padding = 28;
		if (rect.height + padding * 2 >= panelRect.height) {
			panel.scrollBy({ top: rect.top - panelRect.top - padding, behavior: 'smooth' });
			return;
		}
		if (rect.top < panelRect.top + padding) {
			panel.scrollBy({ top: rect.top - panelRect.top - padding, behavior: 'smooth' });
			return;
		}
		if (rect.bottom > panelRect.bottom - padding) {
			panel.scrollBy({ top: rect.bottom - panelRect.bottom + padding, behavior: 'smooth' });
		}
	}

	protected async copyPresign(): Promise<void> {
		const url = this.presignUrl();
		if (!url) return;

		await this.copyText(url, 'link');
	}

	protected toggleCopy(): void {
		if (this.copying()) return;

		this.copyOpen.update((open) => !open);
		if (!this.copyOpen()) return;

		const options = this.destinations();
		if (!options.some((item) => item.id === this.copyTarget())) {
			this.copyTarget.set(options[0]?.id ?? '');
		}
		if (!this.copyPathText()) this.copyPathText.set(this.entry().key);
		this.reveal(this.copyForm);
	}

	protected pickDestination(event: Event): void {
		if (!(event.target instanceof HTMLSelectElement)) return;

		this.copyTarget.set(event.target.value);
		this.clearCopyResult();
	}

	protected onCopyPath(event: Event): void {
		if (!(event.target instanceof HTMLInputElement)) return;

		this.copyPathText.set(event.target.value);
		this.clearCopyResult();
	}

	protected submitCopy(event: Event, overwrite = false): void {
		event.preventDefault();
		void this.beginCopy(overwrite);
	}

	protected stopCopy(): void {
		this.stopCopyJob(true);
	}

	private async beginCopy(overwrite: boolean): Promise<void> {
		if (this.copying()) return;

		this.clearCopyResult();
		const destinationId = this.copyTarget();
		const destinationKey = this.copyPathText().trim().replace(/^\/+/, '');
		if (!destinationId) {
			this.copyError.set(this.i18n.t().copyNeedServer);
			this.reveal(this.copyFeedback);
			return;
		}
		if (!usableKey(destinationKey)) {
			this.copyError.set(this.i18n.t().copyBadPath);
			this.reveal(this.copyFeedback);
			return;
		}
		if (this.demo) {
			this.copyDemo.set(true);
			this.reveal(this.copyFeedback);
			return;
		}

		const blocked = this.copyBlocked();
		if (blocked === 'large') {
			this.copyError.set(this.i18n.t().copyTooLarge);
			this.reveal(this.copyFeedback);
			return;
		}
		if (blocked === 'unknown') {
			this.copyError.set(this.i18n.t().copyUnknownSize);
			this.reveal(this.copyFeedback);
			return;
		}

		const ticket = ++this.copyTicket;
		this.copying.set(true);
		this.copyLoaded.set(0);
		this.copyTotal.set(0);
		this.holdWindow(true);
		try {
			const job = await this.bucket.startCopy({
				key: this.entry().key,
				destinationId,
				destinationKey,
				overwrite,
			});
			if (ticket !== this.copyTicket) {
				void this.bucket.cancelCopy(job.id).catch(() => undefined);
				return;
			}

			this.copyJob = job.id;
			await this.followCopy(job.id, ticket);
		} catch (error) {
			if (ticket !== this.copyTicket) return;

			this.finishCopy(copyCode(error));
		}
	}

	private async followCopy(id: string, ticket: number): Promise<void> {
		try {
			for (;;) {
				if (ticket !== this.copyTicket) return;

				const job = await this.bucket.copyStatus(id);
				if (ticket !== this.copyTicket) return;

				this.copyLoaded.set(job.loaded);
				if (job.total > 0) this.copyTotal.set(job.total);
				if (job.status === 'done') {
					this.copyJob = null;
					this.copying.set(false);
					this.copyDone.set(true);
					this.holdWindow(false);
					this.reveal(this.copyFeedback);
					return;
				}
				if (job.status === 'error') {
					this.copyJob = null;
					this.finishCopy(job.code);
					return;
				}

				await wait(400);
			}
		} catch (error) {
			if (ticket !== this.copyTicket) return;

			this.copyJob = null;
			this.finishCopy(copyCode(error));
		}
	}

	private finishCopy(code: string | null): void {
		this.copying.set(false);
		this.holdWindow(false);
		if (code === 'DestinationExists') this.copyExists.set(true);
		else if (code && code !== 'Canceled') this.copyError.set(this.copyFailure(code));
		if (this.copyExists() || this.copyError()) this.reveal(this.copyFeedback);
	}

	private stopCopyJob(announce: boolean): void {
		const id = this.copyJob;
		this.copyTicket += 1;
		this.copyJob = null;
		this.copying.set(false);
		this.holdWindow(false);
		if (id) void this.bucket.cancelCopy(id).catch(() => undefined);
		if (!announce) return;

		this.copyDone.set(false);
		this.copyExists.set(false);
		this.copyError.set(this.i18n.t().copyCanceled);
	}

	private holdWindow(on: boolean): void {
		if (on === this.copyHeld) return;

		this.copyHeld = on;
		if (on) this.notice.pin();
		else this.notice.unpin();
	}

	private clearCopyResult(): void {
		this.copyError.set(null);
		this.copyExists.set(false);
		this.copyDone.set(false);
		this.copyDemo.set(false);
	}

	private copyFailure(code: string | null): string {
		const t = this.i18n.t();
		switch (code) {
			case 'SourceDenied':
				return t.copySourceDenied;
			case 'DestinationDenied':
				return t.copyDestinationDenied;
			case 'FileTooLarge':
				return t.copyTooLarge;
			case 'UnknownSize':
				return t.copyUnknownSize;
			case 'DestinationExists':
				return t.copyExists;
			case 'SameConnection':
				return t.copySame;
			case 'CopyBusy':
				return t.copyBusy;
			case 'Canceled':
				return t.copyCanceled;
			case 'InvalidKey':
			case 'MissingKey':
				return t.copyBadPath;
			default:
				return messageForError(kindForCopyCode(code), t);
		}
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
		this.downloadDemo.set(false);
		this.copyOpen.set(false);
		this.copyPathText.set('');
		this.clearCopyResult();
		this.copyLoaded.set(0);
		this.copyTotal.set(0);
		clearTimeout(this.copyTimer);
		clearTimeout(this.presignTimer);
		this.stopCopyJob(false);
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
		if (this.downloadBusy() || this.copying()) return;

		this.downloadError.set(null);
		if (this.demo) {
			this.downloadDemo.set(true);
			return;
		}

		this.downloadDemo.set(false);
		this.downloading.set(true);
		try {
			await this.notice.save(this.entry().key, this.entry().name, this.size());
		} catch (error) {
			this.downloadError.set(classifyS3Error(error).kind);
		} finally {
			this.downloading.set(false);
		}
	}
}

function usableKey(value: string): boolean {
	if (!value || value.length > 1024 || value.includes('\\') || value.includes('\0')) return false;

	return value.split('/').every((part) => part && part !== '.' && part !== '..');
}

function copyCode(error: unknown): string | null {
	if (!isAxiosError(error)) return null;

	const data = error.response?.data as { code?: string } | undefined;
	return data?.code ?? null;
}

function kindForCopyCode(code: string | null): S3ErrorKind {
	if (
		code === 'SignatureDoesNotMatch' ||
		code === 'RequestTimeTooSkewed' ||
		code === 'AuthorizationHeaderMalformed'
	) {
		return 'signature';
	}
	if (code === 'NoSuchKey') return 'missing';
	if (code === 'KeystoreUnavailable') return 'keystore';
	if (code === 'FtpHost' || code === 'FtpRefused' || code === 'FtpTimeout') return 'unreachable';
	if (code === 'NoSuchBucket') return 'notFound';
	if (code === 'AccessDenied' || code === 'InvalidAccessKeyId') return 'forbidden';

	return 'generic';
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => {
		window.setTimeout(resolve, ms);
	});
}
