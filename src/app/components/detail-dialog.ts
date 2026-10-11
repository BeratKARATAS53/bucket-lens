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
	private readonly store = inject(ConnectionService);
	private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
	private copyTimer = 0;

	protected readonly meta = signal<ObjectMeta | null>(null);
	protected readonly metaReady = signal(false);
	protected readonly downloading = signal(false);
	protected readonly downloadError = signal<S3ErrorKind | null>(null);
	protected readonly copied = signal(false);
	protected readonly copyFailed = signal(false);

	constructor() {
		const destroyRef = inject(DestroyRef);
		let alive = true;
		let request = 0;
		destroyRef.onDestroy(() => {
			alive = false;
			clearTimeout(this.copyTimer);
		});
		afterNextRender(() => this.panel()?.nativeElement.focus());
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
		this.closed.emit();
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
		try {
			await navigator.clipboard.writeText(this.address());
			this.copied.set(true);
			this.copyFailed.set(false);
		} catch {
			this.copied.set(false);
			this.copyFailed.set(true);
		}
		clearTimeout(this.copyTimer);
		this.copyTimer = window.setTimeout(() => {
			this.copied.set(false);
			this.copyFailed.set(false);
		}, 1600);
	}

	protected async download(): Promise<void> {
		if (this.downloading()) return;
		this.downloading.set(true);
		this.downloadError.set(null);
		try {
			await this.bucket.download(this.entry().key, this.entry().name);
		} catch (error) {
			this.downloadError.set(classifyS3Error(error).kind);
		} finally {
			this.downloading.set(false);
		}
	}
}
