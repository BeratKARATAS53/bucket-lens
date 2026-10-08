import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const filePath = join(root, 'data', 'connection.json');
const fields = ['region', 'endpoint', 'bucket', 'accessKeyId', 'secretAccessKey'];

export function connectionPath() {
	return filePath;
}

export async function readStore() {
	try {
		const parsed = JSON.parse(await readFile(filePath, 'utf8'));
		if (isConnection(parsed)) {
			const store = {
				activeId: randomUUID(),
				connections: [{ id: '', ...normalizeConnection(parsed) }],
			};
			store.connections[0].id = store.activeId;
			await writeStore(store);
			return store;
		}
		if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.connections)) {
			return { activeId: null, connections: [] };
		}
		const connections = parsed.connections.filter(isStoredConnection).map(normalizeStored);
		const activeId = connections.some((item) => item.id === parsed.activeId)
			? parsed.activeId
			: (connections[0]?.id ?? null);
		return { activeId, connections };
	} catch (error) {
		if (error && error.code === 'ENOENT') return { activeId: null, connections: [] };
		throw error;
	}
}

export async function writeStore(store) {
	await mkdir(dirname(filePath), { recursive: true });
	const temporary = `${filePath}.tmp`;
	await writeFile(temporary, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
	await rename(temporary, filePath);
}

export function publicStore(store) {
	return {
		activeId: store.activeId,
		connections: store.connections.map(publicConnection),
	};
}

export function publicConnection(connection) {
	return {
		id: connection.id,
		provider: connection.provider,
		region: connection.region,
		endpoint: connection.endpoint,
		bucket: connection.bucket,
		accessKeyId: connection.accessKeyId,
		hasSecret: Boolean(connection.secretAccessKey),
	};
}

function normalizeConnection(value) {
	const provider = typeof value.provider === 'string' ? value.provider.trim() : '';
	return {
		provider: provider === 'wasabi' || provider === 's3' ? provider : 'backblaze',
		region: value.region.trim(),
		endpoint: value.endpoint.trim(),
		bucket: value.bucket.trim(),
		accessKeyId: value.accessKeyId.trim(),
		secretAccessKey: value.secretAccessKey.trim(),
	};
}

function normalizeStored(value) {
	return { id: value.id, ...normalizeConnection(value) };
}

function isConnection(value) {
	if (!value || typeof value !== 'object' || typeof value.id === 'string') return false;
	return fields.every((key) => typeof value[key] === 'string' && value[key].trim());
}

function isStoredConnection(value) {
	if (!value || typeof value !== 'object' || typeof value.id !== 'string' || !value.id.trim()) {
		return false;
	}
	return fields.every((key) => typeof value[key] === 'string' && value[key].trim());
}
