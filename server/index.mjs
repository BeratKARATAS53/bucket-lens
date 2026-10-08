import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { publicStore, readStore, writeStore } from './store.mjs';
import { headObject, listObjects, openDownload, searchObjects, S3RequestError } from './s3.mjs';

const port = 4215;

const server = createServer(async (req, res) => {
	try {
		const url = new URL(req.url ?? '/', 'http://127.0.0.1');
		if (req.method === 'GET' && url.pathname === '/api/connection') {
			send(res, 200, publicStore(await readStore()));
			return;
		}
		if (req.method === 'PUT' && url.pathname === '/api/connection') {
			send(res, 200, await saveConnection(await readBody(req)));
			return;
		}
		if (req.method === 'PUT' && url.pathname === '/api/connection/active') {
			send(res, 200, await activateConnection(await readBody(req)));
			return;
		}
		if (req.method === 'DELETE' && url.pathname === '/api/connection') {
			send(res, 200, await deleteConnection(url.searchParams.get('id')));
			return;
		}
		if (req.method === 'GET' && url.pathname === '/api/objects') {
			const connection = await requireConnection();
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
		if (req.method === 'GET' && url.pathname === '/api/objects/meta') {
			const key = url.searchParams.get('key');
			if (!key) {
				send(res, 400, { code: 'MissingKey', message: 'key is required' });
				return;
			}
			send(res, 200, await headObject(await requireConnection(), key));
			return;
		}
		if (req.method === 'GET' && url.pathname === '/api/objects/download') {
			const key = url.searchParams.get('key');
			if (!key) {
				send(res, 400, { code: 'MissingKey', message: 'key is required' });
				return;
			}
			const response = await openDownload(await requireConnection(), key);
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
		send(res, 404, { code: 'NotFound', message: 'Unknown route' });
	} catch (error) {
		if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') return;
		if (error instanceof S3RequestError) {
			send(res, error.status || 502, { code: error.code, message: error.message });
			return;
		}
		if (error instanceof HttpError) {
			send(res, error.status, { code: error.code, message: error.message });
			return;
		}
		send(res, 500, { code: 'ServerError', message: 'Local API failed' });
	}
});

server.listen(port, '127.0.0.1');

async function saveConnection(body) {
	const provider = text(body.provider);
	const region = text(body.region);
	const endpoint = normalizeEndpoint(text(body.endpoint));
	const bucket = text(body.bucket);
	const accessKeyId = text(body.accessKeyId);
	if (
		(provider !== 'backblaze' && provider !== 'wasabi' && provider !== 's3') ||
		!region ||
		!endpoint ||
		!bucket ||
		!accessKeyId ||
		/\s/.test(bucket)
	) {
		throw new HttpError(400, 'InvalidConnection', 'Connection fields are incomplete');
	}

	const store = await readStore();
	const id = text(body.id);
	const current = id ? store.connections.find((item) => item.id === id) : null;
	if (id && !current) throw new HttpError(404, 'NotFound', 'Connection was not found');

	let secretAccessKey = text(body.secretAccessKey);
	if (!secretAccessKey && current && current.accessKeyId === accessKeyId) {
		secretAccessKey = current.secretAccessKey;
	}
	if (!secretAccessKey) throw new HttpError(400, 'MissingSecret', 'Secret is required');

	const connection = {
		id: current?.id ?? randomUUID(),
		provider,
		region,
		endpoint,
		bucket,
		accessKeyId,
		secretAccessKey,
	};
	await listObjects(connection, '', null, true, 1);
	const connections = current
		? store.connections.map((item) => (item.id === current.id ? connection : item))
		: [...store.connections, connection];
	const next = { activeId: connection.id, connections };
	await writeStore(next);
	return publicStore(next);
}

async function activateConnection(body) {
	const id = text(body.id);
	const store = await readStore();
	if (!store.connections.some((item) => item.id === id)) {
		throw new HttpError(404, 'NotFound', 'Connection was not found');
	}
	store.activeId = id;
	await writeStore(store);
	return publicStore(store);
}

async function deleteConnection(id) {
	if (!id) throw new HttpError(400, 'MissingId', 'id is required');
	const store = await readStore();
	const connections = store.connections.filter((item) => item.id !== id);
	const activeId = store.activeId === id ? (connections[0]?.id ?? null) : store.activeId;
	const next = { activeId, connections };
	await writeStore(next);
	return publicStore(next);
}

async function requireConnection() {
	const store = await readStore();
	const connection = store.connections.find((item) => item.id === store.activeId);
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

function normalizeEndpoint(value) {
	return value
		.replace(/^https?:\/\//i, '')
		.replace(/\/.*$/, '')
		.trim();
}

function clampKeys(value) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return 200;
	return Math.min(1000, Math.max(1, Math.trunc(parsed)));
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
	return new Promise((resolve, reject) => {
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
				resolve({});
				return;
			}
			try {
				resolve(JSON.parse(raw));
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
