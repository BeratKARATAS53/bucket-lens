import { Injectable, signal } from '@angular/core';
import { normalizeEndpoint } from '../helpers/regions';
import { ConnectionDraft, ConnectionList, ConnectionView } from '../models/bucket';
import { api } from './api';

@Injectable({ providedIn: 'root' })
export class ConnectionService {
	readonly connections = signal<ConnectionView[]>([]);
	readonly config = signal<ConnectionView | null>(null);
	readonly ready = signal(false);

	async load(): Promise<void> {
		try {
			const { data } = await api.get<ConnectionList>('/connection');
			this.apply(data);
		} finally {
			this.ready.set(true);
		}
	}

	async save(draft: ConnectionDraft): Promise<void> {
		const { data } = await api.put<ConnectionList>('/connection', {
			id: draft.id,
			provider: draft.provider,
			region: draft.region.trim(),
			endpoint: normalizeEndpoint(draft.endpoint),
			bucket: draft.bucket.trim(),
			accessKeyId: draft.accessKeyId.trim(),
			secretAccessKey: draft.secretAccessKey.trim(),
		});
		this.apply(data);
	}

	async activate(id: string): Promise<void> {
		const { data } = await api.put<ConnectionList>('/connection/active', { id });
		this.apply(data);
	}

	async remove(id: string): Promise<void> {
		const { data } = await api.delete<ConnectionList>('/connection', { params: { id } });
		this.apply(data);
	}

	private apply(data: ConnectionList): void {
		const connections = Array.isArray(data.connections) ? data.connections : [];
		this.connections.set(connections);
		this.config.set(connections.find((item) => item.id === data.activeId) ?? null);
	}
}
