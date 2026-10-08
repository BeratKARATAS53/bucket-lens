import { Injectable } from '@angular/core';
import { Lang } from '../helpers/i18n';
import { KindFilter, ListPage, ObjectMeta } from '../models/bucket';
import { api } from './api';

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

	async download(key: string, filename: string): Promise<void> {
		const response = await api.get<Blob>('/objects/download', {
			params: { key },
			responseType: 'blob',
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
