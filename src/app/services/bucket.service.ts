import { Injectable } from '@angular/core';
import { isAxiosError } from 'axios';
import { Lang } from '../helpers/i18n';
import { KindFilter, ListPage, ObjectMeta } from '../models/bucket';
import { api } from './api';

export interface PresignLink {
	url: string;
	expiresIn: number;
}

export interface ListFilter {
	q: string;
	kind: KindFilter;
	lang: Lang;
}

@Injectable({ providedIn: 'root' })
export class BucketService {
	async list(
		prefix: string,
		token: string | null,
		delimited: boolean,
		maxKeys = 200,
		filter?: ListFilter,
		signal?: AbortSignal,
	): Promise<ListPage> {
		const { data } = await api.get<ListPage>('/objects', {
			params: {
				prefix,
				token: token ?? undefined,
				delimited,
				maxKeys,
				q: filter?.q || undefined,
				kind: filter && filter.kind !== 'all' ? filter.kind : undefined,
				lang: filter?.lang,
			},
			signal,
		});
		return data;
	}

	async meta(key: string): Promise<ObjectMeta> {
		const { data } = await api.get<ObjectMeta>('/objects/meta', { params: { key } });
		return data;
	}

	async exists(key: string): Promise<boolean> {
		try {
			await this.meta(key);
			return true;
		} catch (error) {
			if (!isAxiosError(error)) throw error;
			const code = (error.response?.data as { code?: string } | undefined)?.code;
			if (error.response?.status === 404 || code === 'NoSuchKey') return false;
			throw error;
		}
	}

	async upload(
		key: string,
		file: File,
		onProgress?: (loaded: number, total: number) => void,
		signal?: AbortSignal,
	): Promise<void> {
		await api.put('/objects', file, {
			params: { key },
			headers: { 'content-type': file.type || 'application/octet-stream' },
			signal,
			onUploadProgress: (event) => {
				onProgress?.(event.loaded, event.total ?? file.size);
			},
		});
	}

	async presign(key: string, minutes: number): Promise<PresignLink> {
		const { data } = await api.get<PresignLink>('/objects/presign', {
			params: { key, minutes },
		});
		return data;
	}

	async download(
		key: string,
		filename: string,
		onProgress?: (loaded: number, total: number) => void,
	): Promise<void> {
		const response = await api.get<Blob>('/objects/download', {
			params: { key },
			responseType: 'blob',
			onDownloadProgress: (event) => {
				onProgress?.(event.loaded, event.total ?? 0);
			},
		});
		const url = URL.createObjectURL(response.data);
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		link.remove();
		window.setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
}
