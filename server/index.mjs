import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ftpPort, isFtpHost, normalizeFtpHost, normalizeFtpRoot } from './ftp.mjs';
import { KeystoreError } from './keystore.mjs';
import { RequestError } from './request-error.mjs';
import { serveStatic } from './static.mjs';
import { createConnectionStore, defaultConnectionPath, publicStore } from './store.mjs';
import { copyBetween as copyObjects, createCopyRunner } from './copy.mjs';
import {
	headObject,
	isObjectKey,
	listObjects,
	objectStats,
	openDownload,
	presignObject,
	putObject,
	searchObjects,
} from './s3.mjs';
import { checkForUpdate, lookupGitHubRelease, readAppVersion } from './update.mjs';

export function startServer({
	port = 4215,
	host = '127.0.0.1',
	staticRoot = null,
	dataDir = null,
	keystore = null,
	version = readAppVersion(),
	releaseLookup = lookupGitHubRelease,
	copyBetween = null,
} = {}) {
	const store = createConnectionStore({
		filePath: dataDir ? join(dataDir, 'connection.json') : defaultConnectionPath(),
		...(keystore ? { keystore } : {}),
	});
	const copies = createCopyRunner(copyBetween ?? copyObjects);
	const server = createServer(async (req, res) => {
		try {
			const url = new URL(req.url ?? '/', 'http://127.0.0.1');
			if (req.method === 'GET' && url.pathname === '/api/update') {
				send(res, 200, await checkForUpdate(version, releaseLookup));
				return;
			}
			if (req.method === 'GET' && url.pathname === '/api/connection') {
				send(res, 200, publicStore(await store.readStore()));
				return;
			}
			if (req.method === 'PUT' && url.pathname === '/api/connection') {
				send(res, 200, await saveConnection(store, await readBody(req)));
				return;
			}
			if (req.method === 'PUT' && url.pathname === '/api/connection/active') {
				send(res, 200, await activateConnection(store, await readBody(req)));
				return;
			}
			if (req.method === 'DELETE' && url.pathname === '/api/connection') {
				send(res, 200, await deleteConnection(store, url.searchParams.get('id')));
				return;
			}
			if (req.method === 'GET' && url.pathname === '/api/objects') {
				const connection = await requireConnection(store);
				const prefix = url.searchParams.get('prefix') ?? '';
				const token = url.searchParams.get('token');
				const delimited = url.searchParams.get('delimited') !== 'false';
				const query = (url.searchParams.get('q') ?? '').trim();
				const kind = url.searchParams.get('kind') ?? 'all';
				const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'tr';
				const signal = clientSignal(res);
				const page =
					query || kind !== 'all'
						? await searchObjects(
								connection,
								{
									prefix,
									token,
									delimited,
									query,
									kind,
									lang,
								},
								signal,
							)
						: await listObjects(
								connection,
								prefix,
								token,
								delimited,
								clampKeys(url.searchParams.get('maxKeys')),
								signal,
							);
				if (signal.aborted) return;

				send(res, 200, page);
				return;
			}
			if (req.method === 'GET' && url.pathname === '/api/objects/stats') {
				const prefix = url.searchParams.get('prefix') ?? '';
				const signal = clientSignal(res);
				const stats = await objectStats(await requireConnection(store), prefix, signal);
				if (signal.aborted) return;

				send(res, 200, stats);
				return;
			}
			if (req.method === 'GET' && url.pathname === '/api/objects/meta') {
				const key = url.searchParams.get('key');
				if (!key) {
					send(res, 400, { code: 'MissingKey', message: 'key is required' });
					return;
				}

				send(res, 200, await headObject(await requireConnection(store), key));
				return;
			}
			if (req.method === 'PUT' && url.pathname === '/api/objects') {
				try {
					const key = url.searchParams.get('key') ?? '';
					if (!isObjectKey(key)) {
						throw new HttpError(
							400,
							key ? 'InvalidKey' : 'MissingKey',
							'key is required',
						);
					}
					const contentLength = Number(req.headers['content-length']);
					if (!Number.isInteger(contentLength) || contentLength < 0) {
						throw new HttpError(411, 'LengthRequired', 'content-length is required');
					}
					await putObject(await requireConnection(store), key, req, {
						contentType: mediaType(req.headers['content-type']),
						contentLength,
						signal: clientSignal(res),
					});
					send(res, 200, { key });
				} catch (error) {
					req.resume();
					throw error;
				}
				return;
			}
			if (req.method === 'GET' && url.pathname === '/api/objects/presign') {
				const key = url.searchParams.get('key') ?? '';
				const minutes = Number(url.searchParams.get('minutes'));
				if (!isObjectKey(key)) {
					send(res, 400, {
						code: key ? 'InvalidKey' : 'MissingKey',
						message: 'key is required',
					});
					return;
				}
				if (!PRESIGN_MINUTES.has(minutes)) {
					send(res, 400, { code: 'InvalidDuration', message: 'Duration is not allowed' });
					return;
				}

				const signed = await presignObject(
					await requireConnection(store),
					key,
					minutes * 60,
				);
				send(res, 200, { url: signed, expiresIn: minutes * 60 });
				return;
			}
			if (
				url.pathname === '/api/objects/copy' &&
				(req.method === 'GET' || req.method === 'DELETE')
			) {
				const job =
					req.method === 'DELETE'
						? copies.cancel(url.searchParams.get('id'))
						: copies.get(url.searchParams.get('id'));
				if (!job) {
					send(res, 404, { code: 'NotFound', message: 'Copy was not found' });
					return;
				}

				send(res, 200, job);
				return;
			}
			if (req.method === 'POST' && url.pathname === '/api/objects/copy') {
				const body = await readBody(req);
				const saved = await store.readStore();
				const source = saved.connections.find((item) => item.id === saved.activeId);
				if (!source) throw new HttpError(404, 'NotConfigured', 'No connection file');
				const destination = saved.connections.find(
					(item) => item.id === text(body.destinationId),
				);
				if (!destination) throw new HttpError(404, 'NotFound', 'Connection was not found');
				if (destination.id === source.id) {
					throw new HttpError(400, 'SameConnection', 'Pick a different server');
				}
				const sourceKey = cleanKey(body.key);
				const destinationKey = cleanKey(body.destinationKey) || sourceKey;
				if (!isObjectKey(sourceKey) || !isObjectKey(destinationKey)) {
					throw new HttpError(
						400,
						sourceKey && destinationKey ? 'InvalidKey' : 'MissingKey',
						'key is required',
					);
				}
				send(
					res,
					202,
					copies.start({
						source,
						destination,
						sourceKey,
						destinationKey,
						overwrite: body.overwrite === true,
					}),
				);
				return;
			}
			if (req.method === 'GET' && url.pathname === '/api/objects/download') {
				const key = url.searchParams.get('key');
				if (!key) {
					send(res, 400, { code: 'MissingKey', message: 'key is required' });
					return;
				}

				const response = await openDownload(await requireConnection(store), key);
				const filename = key.split('/').filter(Boolean).at(-1) || 'download';
				const headers = {
					'content-type': response.headers['content-type'] || 'application/octet-stream',
					'content-disposition': attachmentName(filename),
					'cache-control': 'no-store',
				};
				if (response.headers['content-length'])
					headers['content-length'] = response.headers['content-length'];
				res.writeHead(200, headers);
				response.data.pipe(res);
				return;
			}
			if (url.pathname.startsWith('/api')) {
				send(res, 404, { code: 'NotFound', message: 'Unknown route' });
				return;
			}
			if (staticRoot) {
				await serveStatic(staticRoot, url.pathname, res);
				return;
			}

			send(res, 404, { code: 'NotFound', message: 'Unknown route' });
		} catch (error) {
			if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') return;
			if (error instanceof RequestError) {
				send(res, error.status || 502, { code: error.code, message: error.message });
				return;
			}
			if (error instanceof KeystoreError) {
				send(res, 503, { code: error.code, message: error.message });
				return;
			}
			if (error instanceof HttpError) {
				send(res, error.status, { code: error.code, message: error.message });
				return;
			}

			send(res, 500, { code: 'ServerError', message: 'Local API failed' });
		}
	});

	return new Promise((resolvePromise, reject) => {
		const fail = (error) => reject(error);
		server.once('error', fail);
		server.listen(port, host, () => {
			server.off('error', fail);
			resolvePromise(server);
		});
	});
}

async function saveConnection(store, body) {
	const provider = text(body.provider);
	const ftp = provider === 'ftp';
	if (!ftp && !isS3Provider(provider)) {
		throw new HttpError(400, 'InvalidConnection', 'Connection fields are incomplete');
	}
	const endpoint = ftp ? normalizeFtpHost(body.endpoint) : normalizeEndpoint(text(body.endpoint));
	const region = ftp ? text(body.region) || '21' : text(body.region);
	const bucket = ftp ? normalizeFtpRoot(body.bucket) : text(body.bucket);
	const accessKeyId = text(body.accessKeyId);
	if (ftp) {
		if (!isFtpHost(endpoint) || !ftpPort(region) || !bucket || !accessKeyId) {
			throw new HttpError(400, 'InvalidConnection', 'Connection fields are incomplete');
		}
	} else if (!region || !endpoint || !bucket || !accessKeyId || /\s/.test(bucket)) {
		throw new HttpError(400, 'InvalidConnection', 'Connection fields are incomplete');
	}

	const saved = await store.readStore();
	const id = text(body.id);
	const current = id ? saved.connections.find((item) => item.id === id) : null;
	if (id && !current) throw new HttpError(404, 'NotFound', 'Connection was not found');

	let secretAccessKey = text(body.secretAccessKey);
	if (!secretAccessKey && current && current.accessKeyId === accessKeyId) {
		secretAccessKey = current.secretAccessKey;
	}
	if (!secretAccessKey && !ftp) throw new HttpError(400, 'MissingSecret', 'Secret is required');

	const name = text(body.name);
	const connection = {
		id: current?.id ?? randomUUID(),
		...(name ? { name } : {}),
		provider,
		region: ftp ? String(ftpPort(region)) : region,
		endpoint,
		bucket,
		accessKeyId,
		secretAccessKey,
		...(ftp ? { secure: body.secure === true } : {}),
	};
	await listObjects(connection, '', null, true, 1);
	const connections = current
		? saved.connections.map((item) => (item.id === current.id ? connection : item))
		: [...saved.connections, connection];
	const next = { activeId: connection.id, connections };
	await store.writeStore(next);
	return publicStore(next);
}

async function activateConnection(store, body) {
	const id = text(body.id);
	const saved = await store.readStore();
	const connection = saved.connections.find((item) => item.id === id);
	if (!connection) throw new HttpError(404, 'NotFound', 'Connection was not found');

	await listObjects(connection, '', null, true, 1);
	saved.activeId = id;
	await store.writeStore(saved);
	return publicStore(saved);
}

async function deleteConnection(store, id) {
	if (!id) throw new HttpError(400, 'MissingId', 'id is required');
	const saved = await store.readStore();
	const connections = saved.connections.filter((item) => item.id !== id);
	const activeId = saved.activeId === id ? (connections[0]?.id ?? null) : saved.activeId;
	await store.writeStore({ activeId, connections });
	try {
		await store.forgetSecret(id);
	} catch (error) {
		if (!(error instanceof KeystoreError)) throw error;
	}
	return publicStore({ activeId, connections });
}

async function requireConnection(store) {
	const saved = await store.readStore();
	const connection = saved.connections.find((item) => item.id === saved.activeId);
	if (!connection) throw new HttpError(404, 'NotConfigured', 'No connection file');
	return connection;
}

function clientSignal(res) {
	const controller = new AbortController();
	res.on('close', () => {
		if (!res.writableEnded) controller.abort();
	});
	return controller.signal;
}

function text(value) {
	return typeof value === 'string' ? value.trim() : '';
}

function cleanKey(value) {
	return text(value).replace(/^\/+/, '');
}

function normalizeEndpoint(value) {
	return value
		.replace(/^(https?|ftps?):\/\//i, '')
		.replace(/\/.*$/, '')
		.trim();
}

function clampKeys(value) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return 200;

	return Math.min(1000, Math.max(1, Math.trunc(parsed)));
}

const S3_PROVIDERS = new Set(['backblaze', 'wasabi', 's3', 'r2', 'spaces', 'minio']);

function isS3Provider(provider) {
	return S3_PROVIDERS.has(provider);
}

const PRESIGN_MINUTES = new Set([5, 10, 15, 30, 60, 90, 120]);

function mediaType(value) {
	if (typeof value !== 'string') return 'application/octet-stream';

	const type = value.split(';')[0].trim().toLowerCase();
	if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(type)) return 'application/octet-stream';

	return type;
}

function attachmentName(name) {
	const ascii = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
	return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

function send(res, status, body) {
	res.writeHead(status, {
		'content-type': 'application/json; charset=utf-8',
		'cache-control': 'no-store',
	});
	res.end(JSON.stringify(body));
}

function readBody(req) {
	return new Promise((resolvePromise, reject) => {
		const chunks = [];
		let size = 0;
		req.on('data', (chunk) => {
			size += chunk.length;
			if (size > 65536) {
				reject(new HttpError(413, 'BodyTooLarge', 'Request body is too large'));
				req.destroy();
				return;
			}

			chunks.push(chunk);
		});
		req.on('end', () => {
			const raw = Buffer.concat(chunks).toString('utf8');
			if (!raw) {
				resolvePromise({});
				return;
			}

			try {
				resolvePromise(JSON.parse(raw));
			} catch {
				reject(new HttpError(400, 'InvalidJson', 'Request body is not JSON'));
			}
		});
		req.on('error', reject);
	});
}

class HttpError extends Error {
	constructor(status, code, message) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

const entry = process.argv[1] ? resolve(process.argv[1]) : '';
if (entry && fileURLToPath(import.meta.url) === entry) {
	startServer().catch((error) => {
		console.error(error);
		process.exit(1);
	});
}
