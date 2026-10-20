import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createKeystore, KeystoreError } from './keystore.mjs';

const publicFields = ['region', 'endpoint', 'bucket', 'accessKeyId'];
const legacyFields = [...publicFields, 'secretAccessKey'];

export function defaultConnectionPath() {
	return join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'connection.json');
}

export function createConnectionStore({
	filePath = defaultConnectionPath(),
	keystore = createKeystore({ secretsFile: join(dirname(filePath), 'secrets.json') }),
} = {}) {
	return {
		connectionPath: () => filePath,
		readStore: () => readStore(filePath, keystore),
		writeStore: (store) => writeStore(filePath, keystore, store),
		forgetSecret: (id) => keystore.deleteSecret(id),
	};
}

export async function readStore(filePath, keystore) {
	let parsed;
	try {
		parsed = JSON.parse(await readFile(filePath, 'utf8'));
	} catch (error) {
		if (error && error.code === 'ENOENT') return { activeId: null, connections: [] };

		throw error;
	}

	if (isLegacyConnection(parsed)) {
		const store = {
			activeId: randomUUID(),
			connections: [{ id: '', ...normalizeConnection(parsed) }],
		};
		store.connections[0].id = store.activeId;
		return finishRead(filePath, keystore, store, true);
	}

	if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.connections)) {
		return { activeId: null, connections: [] };
	}

	const connections = parsed.connections.filter(isStoredConnection).map(normalizeStored);
	const activeId = connections.some((item) => item.id === parsed.activeId)
		? parsed.activeId
		: (connections[0]?.id ?? null);
	return finishRead(filePath, keystore, { activeId, connections }, false);
}

async function finishRead(filePath, keystore, store, legacy) {
	let plaintext = false;
	let migrationBlocked = false;
	for (const connection of store.connections) {
		const existing = connection.secretAccessKey;
		if (existing) {
			plaintext = true;
			try {
				await keystore.writeSecret(connection.id, existing);
			} catch (error) {
				if (!(error instanceof KeystoreError)) throw error;
				migrationBlocked = true;
			}
			continue;
		}
		connection.secretAccessKey = (await keystore.readSecret(connection.id)) ?? '';
	}
	if ((legacy || plaintext) && !migrationBlocked) await writeStore(filePath, keystore, store);
	return store;
}

export async function writeStore(filePath, keystore, store) {
	for (const connection of store.connections) {
		if (!connection.secretAccessKey) continue;
		await keystore.writeSecret(connection.id, connection.secretAccessKey);
	}
	const persisted = {
		activeId: store.activeId,
		connections: store.connections.map(persistedConnection),
	};
	await mkdir(dirname(filePath), { recursive: true });
	const temporary = `${filePath}.tmp`;
	await writeFile(temporary, `${JSON.stringify(persisted, null, 2)}\n`, { mode: 0o600 });
	try {
		await rename(temporary, filePath);
	} catch (error) {
		if (process.platform !== 'win32') throw error;
		await rm(filePath, { force: true });
		await rename(temporary, filePath);
	}
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
		...(typeof connection.name === 'string' && connection.name.trim()
			? { name: connection.name.trim() }
			: {}),
		provider: connection.provider,
		region: connection.region,
		endpoint: connection.endpoint,
		bucket: connection.bucket,
		accessKeyId: connection.accessKeyId,
		hasSecret: Boolean(connection.secretAccessKey),
		...(connection.provider === 'ftp' ? { secure: connection.secure === true } : {}),
	};
}

function persistedConnection(connection) {
	return {
		id: connection.id,
		...(typeof connection.name === 'string' && connection.name.trim()
			? { name: connection.name.trim() }
			: {}),
		provider: connection.provider,
		region: connection.region,
		endpoint: connection.endpoint,
		bucket: connection.bucket,
		accessKeyId: connection.accessKeyId,
		...(connection.provider === 'ftp' ? { secure: connection.secure === true } : {}),
	};
}

function normalizeConnection(value) {
	const provider = typeof value.provider === 'string' ? value.provider.trim() : '';
	return {
		...(typeof value.name === 'string' && value.name.trim() ? { name: value.name.trim() } : {}),
		provider:
			provider === 'wasabi' ||
			provider === 's3' ||
			provider === 'r2' ||
			provider === 'spaces' ||
			provider === 'minio' ||
			provider === 'ftp'
				? provider
				: 'backblaze',
		region: value.region.trim(),
		endpoint: value.endpoint.trim(),
		bucket: value.bucket.trim(),
		accessKeyId: value.accessKeyId.trim(),
		secretAccessKey:
			typeof value.secretAccessKey === 'string' ? value.secretAccessKey.trim() : '',
		secure: value.secure === true,
	};
}

function normalizeStored(value) {
	return { id: value.id.trim(), ...normalizeConnection(value) };
}

function isLegacyConnection(value) {
	if (!value || typeof value !== 'object' || typeof value.id === 'string') return false;

	return legacyFields.every((key) => typeof value[key] === 'string' && value[key].trim());
}

function isStoredConnection(value) {
	if (!value || typeof value !== 'object' || typeof value.id !== 'string' || !value.id.trim()) {
		return false;
	}

	return publicFields.every((key) => typeof value[key] === 'string' && value[key].trim());
}
