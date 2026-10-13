import { PassThrough, Readable } from 'node:stream';
import { Client } from 'basic-ftp';
import { RequestError } from './request-error.mjs';

const TIMEOUT_MS = 20000;

const MIME = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	gif: 'image/gif',
	webp: 'image/webp',
	svg: 'image/svg+xml',
	avif: 'image/avif',
	bmp: 'image/bmp',
	ico: 'image/x-icon',
	mp4: 'video/mp4',
	mov: 'video/quicktime',
	mkv: 'video/x-matroska',
	webm: 'video/webm',
	avi: 'video/x-msvideo',
	mp3: 'audio/mpeg',
	wav: 'audio/wav',
	flac: 'audio/flac',
	aac: 'audio/aac',
	ogg: 'audio/ogg',
	m4a: 'audio/mp4',
	pdf: 'application/pdf',
	txt: 'text/plain; charset=utf-8',
	md: 'text/markdown; charset=utf-8',
	csv: 'text/csv; charset=utf-8',
	json: 'application/json',
	zip: 'application/zip',
	gz: 'application/gzip',
};

export function ftpPort(value) {
	const port = Number(String(value ?? '').trim());
	if (!Number.isInteger(port) || port < 1 || port > 65535) return null;

	return port;
}

export function normalizeFtpHost(value) {
	return String(value ?? '')
		.trim()
		.replace(/^(https?|ftps?):\/\//i, '')
		.replace(/\/.*$/, '')
		.trim();
}

export function isFtpHost(host) {
	return Boolean(host) && !/[\s/@:\\]/.test(host);
}

export function normalizeFtpRoot(value) {
	const raw = String(value ?? '')
		.trim()
		.replace(/\\/g, '/');
	if (!raw || raw === '/') return '/';

	const parts = raw.split('/');
	if (parts.some((part) => part === '.' || part === '..')) return null;

	const kept = parts.filter(Boolean);
	return kept.length ? kept.join('/') : '/';
}

export function ftpJoin(bucket, prefix) {
	const root = strip(bucket);
	const relative = strip(prefix);
	return [root, relative].filter(Boolean).join('/');
}

export async function listFtp(
	connection,
	prefix,
	token,
	delimited,
	maxKeys,
	signal,
	connect = connectFtp,
) {
	const dir = asDirPrefix(prefix);
	if (dir == null) throw new RequestError(400, 'InvalidKey', 'Invalid path');
	const limit = clamp(maxKeys);
	return useClient(connection, signal, connect, async (client) => {
		if (delimited) return listOne(client, connection, dir, token, limit);

		return walk(client, connection, dir, token, limit, signal);
	});
}

export async function headFtp(connection, key, connect = connectFtp) {
	const relative = sanitizeRelative(key);
	if (!relative) throw new RequestError(404, 'NoSuchKey', 'FTP path was not found');
	const slash = relative.lastIndexOf('/');
	const parent = slash >= 0 ? `${relative.slice(0, slash)}/` : '';
	const name = relative.slice(slash + 1);
	return useClient(connection, undefined, connect, async (client) => {
		const items = await readDir(client, connection, parent, parent);
		const found = items.find((item) => item.name === name && item.kind === 'file');
		if (!found) throw new RequestError(404, 'NoSuchKey', 'FTP path was not found');
		return {
			contentType: contentTypeFor(name),
			size: found.size,
			etag: null,
			lastModified: found.lastModified,
			storageClass: null,
		};
	});
}

export async function putFtp(connection, key, body, connect = connectFtp, signal) {
	const relative = sanitizeRelative(key);
	if (!relative) throw new RequestError(400, 'InvalidKey', 'Invalid path');
	if (signal?.aborted) throw canceled();
	const client = await connect(connection);
	const onAbort = () => client.close();
	signal?.addEventListener('abort', onAbort, { once: true });
	try {
		await client.uploadFrom(asReadable(body), ftpJoin(connection.bucket, relative));
	} catch (error) {
		if (signal?.aborted) throw canceled();
		throw error instanceof RequestError ? error : ftpError(error);
	} finally {
		signal?.removeEventListener('abort', onAbort);
		client.close();
	}
}

export async function removeFtp(connection, key, connect = connectFtp) {
	const relative = sanitizeRelative(key);
	if (!relative) throw new RequestError(400, 'InvalidKey', 'Invalid path');
	return useClient(connection, undefined, connect, async (client) => {
		await client.remove(ftpJoin(connection.bucket, relative));
	});
}

export async function probeFtpRead(connection, key, connect = connectFtp) {
	const relative = sanitizeRelative(key);
	if (!relative) throw new RequestError(403, 'AccessDenied', 'FTP read was denied');
	return useClient(connection, undefined, connect, async (client) => {
		const remote = ftpJoin(connection.bucket, relative);
		try {
			await client.size(remote);
			return;
		} catch (error) {
			if (error?.code === 530) {
				throw new RequestError(403, 'AccessDenied', 'FTP read was denied');
			}
			if (
				error?.code === 500 ||
				error?.code === 502 ||
				error?.code === 550 ||
				error?.code === 553
			) {
				await readOneByte(client, remote);
				return;
			}

			throw error instanceof RequestError ? error : ftpError(error);
		}
	});
}

export async function openFtpDownload(connection, key, connect = connectFtp) {
	const relative = sanitizeRelative(key);
	if (!relative) throw new RequestError(404, 'NoSuchKey', 'FTP path was not found');
	const client = await connect(connection);
	const remote = ftpJoin(connection.bucket, relative);
	let size = null;
	try {
		size = await client.size(remote);
	} catch (error) {
		if (error?.code === 550) {
			client.close();
			throw ftpError(error);
		}
		size = null;
	}
	const stream = new PassThrough();
	client.downloadTo(stream, remote).then(
		() => client.close(),
		(error) => {
			client.close();
			if (!stream.destroyed) stream.destroy(ftpError(error));
		},
	);
	const headers = { 'content-type': contentTypeFor(relative) };
	if (Number.isFinite(size) && size >= 0) headers['content-length'] = String(size);
	return { headers, data: stream };
}

export async function connectFtp(connection) {
	const host = normalizeFtpHost(connection.endpoint);
	const port = ftpPort(connection.region);
	if (!isFtpHost(host) || !port) {
		throw new RequestError(400, 'InvalidConnection', 'FTP host is incomplete');
	}
	const client = new Client(TIMEOUT_MS);
	client.ftp.verbose = false;
	try {
		await client.access({
			host,
			port,
			user: connection.accessKeyId || 'anonymous',
			password: connection.secretAccessKey || '',
			secure: connection.secure === true,
		});
		return client;
	} catch (error) {
		client.close();
		throw ftpError(error);
	}
}

async function useClient(connection, signal, connect, run) {
	if (signal?.aborted) throw canceled();
	const client = await connect(connection);
	const onAbort = () => client.close();
	signal?.addEventListener('abort', onAbort, { once: true });
	try {
		return await run(client);
	} catch (error) {
		if (signal?.aborted) throw canceled();
		throw error instanceof RequestError ? error : ftpError(error);
	} finally {
		signal?.removeEventListener('abort', onAbort);
		client.close();
	}
}

async function listOne(client, connection, dir, token, limit) {
	const state = decodeToken(token);
	const offset = state && state.queue[0] === dir ? state.offset : 0;
	const items = await readDir(client, connection, dir, dir);
	const entries = items.slice(offset, offset + limit);
	const next = offset + entries.length;
	return {
		entries,
		nextToken: next < items.length ? encodeToken({ queue: [dir], offset: next }) : null,
	};
}

async function walk(client, connection, origin, token, limit, signal) {
	const state = decodeToken(token) ?? { queue: [origin], offset: 0 };
	const entries = [];
	while (state.queue.length && entries.length < limit) {
		if (signal?.aborted) throw canceled();
		const dir = state.queue[0];
		const items = await readDir(client, connection, dir, origin);
		const start = state.offset > items.length ? items.length : state.offset;
		for (let index = start; index < items.length; index += 1) {
			const entry = items[index];
			entries.push(entry);
			if (entry.kind === 'folder') state.queue.push(entry.key);
			if (entries.length >= limit) {
				const next = index + 1;
				if (next >= items.length) {
					state.queue.shift();
					state.offset = 0;
				} else state.offset = next;
				return {
					entries,
					nextToken: state.queue.length ? encodeToken(state) : null,
				};
			}
		}
		state.queue.shift();
		state.offset = 0;
	}
	return { entries, nextToken: null };
}

async function readDir(client, connection, dir, origin) {
	let listed;
	try {
		listed = await client.list(ftpJoin(connection.bucket, dir));
	} catch (error) {
		throw error instanceof RequestError ? error : ftpError(error);
	}
	const items = Array.isArray(listed) ? listed : [];
	const entries = [];
	for (const item of items) {
		const name = safeName(item?.name);
		if (!name) continue;
		const directory = item.isDirectory === true && item.isSymbolicLink !== true;
		const key = `${dir}${name}${directory ? '/' : ''}`;
		const relative = relativeOf(key, origin);
		const modified =
			item.modifiedAt instanceof Date && !Number.isNaN(item.modifiedAt.getTime())
				? item.modifiedAt.toISOString()
				: null;
		entries.push({
			kind: directory ? 'folder' : 'file',
			key,
			name: nameOf(relative),
			relative,
			size: directory || !Number.isFinite(item.size) ? null : item.size,
			lastModified: modified,
			etag: null,
			storageClass: null,
		});
	}
	return entries;
}

function encodeToken(state) {
	return Buffer.from(
		JSON.stringify({ queue: state.queue, offset: state.offset }),
		'utf8',
	).toString('base64url');
}

function decodeToken(token) {
	if (!token) return null;

	try {
		const parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
		if (!parsed || !Array.isArray(parsed.queue) || !parsed.queue.length) return null;

		const offset = parsed.offset;
		if (!Number.isInteger(offset) || offset < 0 || offset > 100000) return null;

		const queue = [];
		for (const dir of parsed.queue) {
			if (typeof dir !== 'string') return null;

			const clean = asDirPrefix(dir);
			if (clean == null) return null;

			queue.push(clean);
		}
		return { queue, offset };
	} catch {
		return null;
	}
}

function asDirPrefix(prefix) {
	const clean = sanitizeRelative(prefix);
	if (clean == null) return null;

	return clean ? `${clean}/` : '';
}

function sanitizeRelative(value) {
	const parts = String(value ?? '')
		.replace(/\\/g, '/')
		.split('/');
	if (parts.some((part) => part === '.' || part === '..')) return null;

	return parts.filter(Boolean).join('/');
}

function safeName(name) {
	if (typeof name !== 'string') return null;

	const trimmed = name.trim();
	if (!trimmed || trimmed === '.' || trimmed === '..') return null;
	if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('\0')) return null;

	return trimmed;
}

function strip(value) {
	return String(value ?? '')
		.replace(/\\/g, '/')
		.replace(/^\/+|\/+$/g, '');
}

function relativeOf(key, prefix) {
	const rest = prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key;
	return rest.replace(/\/$/, '');
}

function nameOf(relative) {
	const parts = relative.split('/').filter(Boolean);
	return parts.at(-1) || relative;
}

function asReadable(body) {
	if (body && typeof body.pipe === 'function') return body;
	if (Buffer.isBuffer(body)) return Readable.from([body]);

	return Readable.from([]);
}

async function readOneByte(client, remote) {
	const stream = new PassThrough();
	let sawData = false;
	stream.on('error', () => {});
	stream.on('data', () => {
		sawData = true;
		stream.destroy();
	});
	try {
		await client.downloadTo(stream, remote);
	} catch (error) {
		if (!stream.destroyed) stream.destroy();
		if (sawData) return;

		throw ftpReadDenied(error);
	}
}

function ftpReadDenied(error) {
	if (error?.code === 530 || error?.code === 550 || error?.code === 553) {
		return new RequestError(403, 'AccessDenied', 'FTP read was denied');
	}

	return error instanceof RequestError ? error : ftpError(error);
}

function contentTypeFor(name) {
	const base = name.split('/').pop() ?? name;
	const dot = base.lastIndexOf('.');
	const extension = dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
	return MIME[extension] || 'application/octet-stream';
}

function clamp(value) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return 200;

	return Math.min(1000, Math.max(1, Math.trunc(parsed)));
}

function canceled() {
	const error = new Error('canceled');
	error.name = 'CanceledError';
	error.code = 'ERR_CANCELED';
	return error;
}

function ftpError(error) {
	if (error instanceof RequestError) return error;

	const code = error?.code;
	if (code === 530) return new RequestError(401, 'AccessDenied', 'FTP login was rejected');
	if (code === 550 || code === 553)
		return new RequestError(404, 'NoSuchKey', 'FTP path was not found');
	if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
		return new RequestError(502, 'FtpHost', 'FTP host was not found');
	}
	if (code === 'ECONNREFUSED') {
		return new RequestError(502, 'FtpRefused', 'FTP server refused the connection');
	}
	if (code === 'ETIMEDOUT' || code === 'ECONNRESET') {
		return new RequestError(502, 'FtpTimeout', 'FTP server did not respond');
	}
	if (
		code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
		code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
		code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
		code === 'CERT_HAS_EXPIRED'
	) {
		return new RequestError(502, 'FtpTls', 'FTP TLS certificate was rejected');
	}

	const message =
		typeof error?.message === 'string' ? error.message.slice(0, 300) : 'FTP request failed';
	return new RequestError(502, typeof code === 'number' ? `Ftp${code}` : 'FtpError', message);
}
