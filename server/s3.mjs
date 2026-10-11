import axios from 'axios';
import { AwsClient } from 'aws4fetch';
import { headFtp, listFtp, openFtpDownload } from './ftp.mjs';
import { RequestError } from './request-error.mjs';

export class S3RequestError extends RequestError {
	constructor(status, code, message) {
		super(status, code, message || code || 'S3 request failed');
		this.name = 'S3RequestError';
	}
}

export async function listObjects(connection, prefix, token, delimited, maxKeys, signal) {
	if (connection?.provider === 'ftp') {
		return listFtp(connection, prefix, token, delimited, maxKeys, signal);
	}
	const params = new URLSearchParams({
		'list-type': '2',
		'max-keys': String(maxKeys),
		'encoding-type': 'url',
	});
	if (delimited) params.set('delimiter', '/');
	if (prefix) params.set('prefix', prefix);
	if (token) params.set('continuation-token', token);

	const xml = await requestText(connection, `/?${params.toString()}`, signal);
	const errorCode = tagText(xml, 'Code');
	if (errorCode && xml.includes('<Error>')) {
		throw new S3RequestError(400, errorCode, tagText(xml, 'Message'));
	}

	const entries = [];
	for (const match of xml.matchAll(/<CommonPrefixes>([\s\S]*?)<\/CommonPrefixes>/g)) {
		const key = decodeKey(tagText(match[1], 'Prefix'));
		if (!key || key === prefix) continue;
		const relative = relativeOf(key, prefix);
		entries.push({
			kind: 'folder',
			key,
			name: nameOf(relative),
			relative,
			size: null,
			lastModified: null,
			etag: null,
			storageClass: null,
		});
	}

	for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
		const key = decodeKey(tagText(match[1], 'Key'));
		if (!key || key === prefix || key.endsWith('/')) continue;
		const relative = relativeOf(key, prefix);
		const size = Number(tagText(match[1], 'Size'));
		entries.push({
			kind: 'file',
			key,
			name: nameOf(relative),
			relative,
			size: Number.isFinite(size) ? size : null,
			lastModified: tagText(match[1], 'LastModified'),
			etag: stripQuotes(tagText(match[1], 'ETag')),
			storageClass: tagText(match[1], 'StorageClass'),
		});
	}

	const truncated = tagText(xml, 'IsTruncated') === 'true';
	const nextToken = truncated ? tagText(xml, 'NextContinuationToken') : null;
	return { entries, nextToken };
}

const EXTENSIONS = {
	image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'heic', 'bmp', 'ico'],
	video: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v'],
	audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'opus'],
	document: [
		'pdf',
		'doc',
		'docx',
		'xls',
		'xlsx',
		'ppt',
		'pptx',
		'txt',
		'md',
		'csv',
		'json',
		'rtf',
		'odt',
	],
	archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz'],
};

const KIND_TO_FILE = {
	images: 'image',
	videos: 'video',
	audio: 'audio',
	documents: 'document',
	archives: 'archive',
	other: 'other',
};

export async function searchObjects(
	connection,
	{ prefix, token, delimited, query, kind, lang },
	signal,
) {
	const needle = query ? query.toLocaleLowerCase(lang === 'en' ? 'en' : 'tr') : '';
	let scanned = 0;
	const entries = [];
	let next = token;
	let pages = 0;
	do {
		if (signal?.aborted) break;
		const page = await listObjects(connection, prefix, next, delimited, 1000, signal);
		scanned += page.entries.length;
		for (const entry of page.entries) {
			if (matchesEntry(entry, needle, kind, lang)) entries.push(entry);
		}
		next = page.nextToken;
		pages += 1;
	} while (next && pages < 8 && entries.length === 0);
	return { entries, nextToken: next, scanned };
}

export async function headObject(connection, key) {
	if (connection?.provider === 'ftp') return headFtp(connection, key);
	const response = await signedRequest(connection, objectPath(key), 'HEAD');
	if (response.status >= 400) throw await errorFromResponse(response);
	return {
		contentType: response.headers['content-type'] ?? null,
		size: headerNumber(response.headers['content-length']),
		etag: stripQuotes(response.headers.etag ?? null),
		lastModified: response.headers['last-modified'] ?? null,
		storageClass: response.headers['x-amz-storage-class'] ?? null,
	};
}

export async function openDownload(connection, key) {
	if (connection?.provider === 'ftp') return openFtpDownload(connection, key);
	const response = await signedRequest(connection, objectPath(key), 'GET', 'stream');
	if (response.status >= 400) throw await errorFromResponse(response);
	return response;
}

async function requestText(connection, path, signal) {
	const response = await signedRequest(connection, path, 'GET', 'text', signal);
	if (response.status >= 400) throw await errorFromResponse(response);
	return String(response.data);
}

async function signedRequest(connection, path, method, responseType = 'text', signal) {
	const url = requestUrl(connection, path);
	const client = new AwsClient({
		accessKeyId: connection.accessKeyId,
		secretAccessKey: connection.secretAccessKey,
		service: 's3',
		region: connection.region,
		retries: 1,
	});
	const signed = await client.sign(url, {
		method,
		headers: { 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD' },
	});
	const headers = {};
	signed.headers.forEach((value, key) => {
		headers[key] = value;
	});
	return axios.request({
		url: signed.url,
		method,
		headers,
		responseType,
		signal,
		validateStatus: () => true,
	});
}

async function errorFromResponse(response) {
	const raw = response.data;
	const xml =
		typeof raw === 'string'
			? raw
			: Buffer.isBuffer(raw)
				? raw.toString('utf8')
				: raw && typeof raw.on === 'function'
					? await streamToString(raw)
					: '';
	return new S3RequestError(response.status, tagText(xml, 'Code'), tagText(xml, 'Message'));
}

function streamToString(stream) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		stream.on('data', (chunk) => chunks.push(chunk));
		stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
		stream.on('error', reject);
	});
}

function requestUrl(connection, path) {
	if (connection.provider === 's3') {
		return `https://${connection.bucket}.${connection.endpoint}${path}`;
	}
	return `https://${connection.endpoint}/${encodeURIComponent(connection.bucket)}${path}`;
}

function objectPath(key) {
	const encoded = key
		.split('/')
		.map((part) => encodeURIComponent(part))
		.join('/');
	return `/${encoded}`;
}

function tagText(block, tag) {
	if (!block) return null;
	const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
	return match ? decodeXml(match[1].trim()) : null;
}

function decodeXml(value) {
	return value
		.replace(/&quot;/g, '"')
		.replace(/&apos;|&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');
}

function decodeKey(value) {
	if (!value) return null;
	const normalized = value.replace(/\+/g, ' ');
	try {
		return decodeURIComponent(normalized);
	} catch {
		return normalized;
	}
}

function relativeOf(key, prefix) {
	const rest = prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key;
	return rest.replace(/\/$/, '');
}

function nameOf(relative) {
	const parts = relative.split('/').filter(Boolean);
	return parts.at(-1) || relative;
}

function stripQuotes(value) {
	return value ? value.replace(/^"|"$/g, '') : null;
}

function matchesEntry(entry, needle, kind, lang) {
	if (kind === 'folders') {
		if (entry.kind !== 'folder') return false;
	} else if (kind && kind !== 'all') {
		if (entry.kind === 'folder') return false;
		if (fileKindOf(entry.name) !== KIND_TO_FILE[kind]) return false;
	}
	if (!needle) return true;
	const locale = lang === 'en' ? 'en' : 'tr';
	return `${entry.name} ${entry.relative}`.toLocaleLowerCase(locale).includes(needle);
}

function fileKindOf(name) {
	const base = name.split('/').pop() ?? name;
	const dot = base.lastIndexOf('.');
	const extension = dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
	for (const [kind, list] of Object.entries(EXTENSIONS)) {
		if (list.includes(extension)) return kind;
	}
	return 'other';
}

function headerNumber(value) {
	if (!value) return null;
	const size = Number(value);
	return Number.isFinite(size) ? size : null;
}
