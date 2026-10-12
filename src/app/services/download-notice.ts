import { Injectable, effect, inject, signal } from '@angular/core';
import { classifyS3Error } from '../helpers/errors';
import { S3ErrorKind } from '../models/bucket';
import { BucketService } from './bucket.service';

export const LARGE_DOWNLOAD = 50 * 1024 * 1024;

export interface DownloadToast {
	name: string;
	loaded: number;
	total: number;
	phase: 'active' | 'done' | 'error';
	error: S3ErrorKind | null;
}

interface BucketLensBridge {
	setDownloadLock(locked: boolean): void;
}

declare global {
	interface Window {
		bucketLens?: BucketLensBridge;
	}
}

@Injectable({ providedIn: 'root' })
export class DownloadNotice {
	readonly toast = signal<DownloadToast | null>(null);

	private readonly bucket = inject(BucketService);
	private hideTimer = 0;

	constructor() {
		effect(() => {
			const locked = this.toast()?.phase === 'active';
			if (typeof window === 'undefined') return;
			window.bucketLens?.setDownloadLock(locked);
		});
	}

	busy(): boolean {
		return this.toast()?.phase === 'active';
	}

	async save(key: string, filename: string, size: number | null): Promise<void> {
		let tracked = (size ?? 0) > LARGE_DOWNLOAD;
		let total = size ?? 0;
		if (tracked) this.begin(filename, total);
		try {
			await this.bucket.download(key, filename, (loaded, reported) => {
				if (reported > 0) total = reported;
				if (!tracked && total > LARGE_DOWNLOAD) {
					tracked = true;
					this.begin(filename, total);
				}
				if (tracked) this.progress(loaded, total);
			});
			if (tracked) this.finish();
		} catch (error) {
			if (tracked) this.fail(classifyS3Error(error).kind);
			throw error;
		}
	}

	private begin(name: string, total: number): void {
		window.clearTimeout(this.hideTimer);
		this.toast.set({ name, loaded: 0, total, phase: 'active', error: null });
	}

	private progress(loaded: number, total: number): void {
		this.toast.update((current) =>
			current && current.phase === 'active' ? { ...current, loaded, total } : current,
		);
	}

	private finish(): void {
		this.toast.update((current) =>
			current
				? {
						...current,
						phase: 'done',
						loaded: current.total || current.loaded,
						error: null,
					}
				: current,
		);
		this.hideLater(2800);
	}

	private fail(error: S3ErrorKind): void {
		this.toast.update((current) => (current ? { ...current, phase: 'error', error } : current));
		this.hideLater(5200);
	}

	private hideLater(ms: number): void {
		window.clearTimeout(this.hideTimer);
		this.hideTimer = window.setTimeout(() => this.toast.set(null), ms);
	}
}

export function downloadPercent(item: DownloadToast): number {
	if (item.total <= 0) return 0;
	return Math.min(100, Math.round((item.loaded / item.total) * 100));
}
