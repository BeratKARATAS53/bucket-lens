import { randomBytes, randomUUID } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { RequestError } from './request-error.mjs';
import { probeFtpRead } from './ftp.mjs';
import {
	copyS3Object,
	deleteObject,
	headObject,
	isObjectKey,
	openDownload,
	putObject,
} from './s3.mjs';

export const COPY_LIMIT_BYTES = 1024 * 1024 * 1024;

const SERVER_COPY_FALLBACK = new Set([
	'AccessDenied',
	'AllAccessDisabled',
	'InvalidRequest',
	'PermanentRedirect',
	'AuthorizationHeaderMalformed',
]);

export async function copyBetween(source, destination, sourceKey, destinationKey, options = {}) {
	const io = {
		headObject,
		putObject,
		deleteObject,
		openDownload,
		copyS3Object,
		probeFtpRead,
		...options.io,
	};
	if (source?.id && source.id === destination?.id) {
		throw new RequestError(400, 'SameConnection', 'Pick a different server');
	}
	if (!isObjectKey(sourceKey) || !isObjectKey(destinationKey)) {
		throw new RequestError(400, 'InvalidKey', 'Invalid path');
	}
	if (options.signal?.aborted) throw canceled();

	let meta;
	try {
		meta = await io.headObject(source, sourceKey);
	} catch (error) {
		throw mapDenied(error, 'SourceDenied');
	}
	const size = meta?.size;
	if (size == null || !Number.isFinite(size) || size < 0) {
		throw new RequestError(400, 'UnknownSize', 'File size is unknown');
	}
	if (size > COPY_LIMIT_BYTES) {
		throw new RequestError(413, 'FileTooLarge', 'File is larger than 1 GB');
	}

	if (!options.overwrite) {
		try {
			await io.headObject(destination, destinationKey);
			throw new RequestError(409, 'DestinationExists', 'Destination already has this file');
		} catch (error) {
			if (error instanceof RequestError && error.code === 'DestinationExists') throw error;
			if (!isMissing(error) && !isAccessDenied(error)) throw error;
		}
	}

	if (source?.provider === 'ftp') {
		try {
			await io.probeFtpRead(source, sourceKey);
		} catch (error) {
			throw mapDenied(error, 'SourceDenied');
		}
	}

	const probeKey = probeObjectKey(destinationKey);
	try {
		await io.putObject(destination, probeKey, emptyBody(destination), {
			contentType: 'application/octet-stream',
			contentLength: 0,
			signal: options.signal,
		});
	} catch (error) {
		throw mapWrite(error);
	}
	try {
		await io.deleteObject(destination, probeKey);
	} catch {
		// A key that can write but cannot delete still gets the copy.
	}
	if (options.signal?.aborted) throw canceled();

	options.onProgress?.(0, size);
	if (canServerCopy(source, destination)) {
		try {
			await io.copyS3Object(destination, source, sourceKey, destinationKey, options.signal);
			options.onProgress?.(size, size);
			return { key: destinationKey, bytes: size, method: 'server' };
		} catch (error) {
			if (!shouldStreamInstead(error)) throw mapDenied(error, 'DestinationDenied');
		}
	}

	await streamCopy(
		io,
		source,
		destination,
		sourceKey,
		destinationKey,
		size,
		meta.contentType,
		options,
	);
	return { key: destinationKey, bytes: size, method: 'stream' };
}

export function createCopyRunner(runCopy) {
	const jobs = new Map();

	return {
		start({ source, destination, sourceKey, destinationKey, overwrite = false }) {
			prune(jobs);
			if (busy(jobs)) throw new RequestError(409, 'CopyBusy', 'Another copy is running');
			const controller = new AbortController();
			const job = {
				id: randomUUID(),
				status: 'checking',
				loaded: 0,
				total: 0,
				key: destinationKey,
				code: null,
				method: null,
				controller,
				updated: Date.now(),
			};
			jobs.set(job.id, job);
			void runJob(job, () =>
				runCopy(source, destination, sourceKey, destinationKey, {
					overwrite,
					signal: controller.signal,
					onProgress(loaded, total) {
						if (
							controller.signal.aborted ||
							job.status === 'error' ||
							job.status === 'done'
						) {
							return;
						}

						job.status = 'copying';
						job.loaded = loaded;
						job.total = total;
						job.updated = Date.now();
					},
				}),
			);
			return publicJob(job);
		},
		get(id) {
			prune(jobs);
			const job = jobs.get(id);
			return job ? publicJob(job) : null;
		},
		cancel(id) {
			const job = jobs.get(id);
			if (!job) return null;

			job.controller.abort();
			if (job.status === 'checking' || job.status === 'copying') {
				job.status = 'error';
				job.code = 'Canceled';
				job.updated = Date.now();
			}
			return publicJob(job);
		},
	};
}

async function runJob(job, work) {
	try {
		const result = await work();
		if (job.controller.signal.aborted) {
			job.status = 'error';
			job.code = 'Canceled';
			return;
		}

		job.status = 'done';
		job.loaded = result.bytes;
		job.total = result.bytes;
		job.key = result.key;
		job.method = result.method;
		job.code = null;
	} catch (error) {
		job.status = 'error';
		job.code = job.controller.signal.aborted ? 'Canceled' : error?.code || 'ServerError';
	} finally {
		job.updated = Date.now();
	}
}

async function streamCopy(
	io,
	source,
	destination,
	sourceKey,
	destinationKey,
	size,
	contentType,
	options,
) {
	let download;
	try {
		download = await io.openDownload(source, sourceKey, options.signal);
	} catch (error) {
		throw mapDenied(error, 'SourceDenied');
	}
	const incoming = download?.data;
	if (!incoming || typeof incoming.pipe !== 'function') {
		throw new RequestError(502, 'CopyFailed', 'Source did not provide a file stream');
	}

	let loaded = 0;
	let streamError = null;
	const counter = new Transform({
		transform(chunk, _encoding, callback) {
			const bytes = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
			loaded += bytes;
			if (loaded > COPY_LIMIT_BYTES) {
				streamError = new RequestError(413, 'FileTooLarge', 'File is larger than 1 GB');
				callback(streamError);
				return;
			}

			options.onProgress?.(loaded, size);
			callback(null, chunk);
		},
	});
	incoming.on('error', (error) => {
		streamError ??= error;
	});
	const body = incoming.pipe(counter);
	const fail = () => {
		if (!incoming.destroyed) incoming.destroy();
		if (!counter.destroyed) counter.destroy();
	};
	if (options.signal?.aborted) {
		fail();
		throw canceled();
	}
	const onAbort = () => fail();
	options.signal?.addEventListener('abort', onAbort, { once: true });
	try {
		await io.putObject(destination, destinationKey, body, {
			contentType: contentType || 'application/octet-stream',
			contentLength: size,
			signal: options.signal,
		});
		if (streamError) throw streamError;
		if (loaded !== size) {
			throw new RequestError(502, 'SizeMismatch', 'Copied size did not match the source');
		}
	} catch (error) {
		fail();
		if (destination?.provider === 'ftp') {
			try {
				await io.deleteObject(destination, destinationKey);
			} catch {
				// The partial upload is removed when the server allows it.
			}
		}
		if (options.signal?.aborted) throw canceled();
		throw mapDenied(streamError ?? error, 'DestinationDenied');
	} finally {
		options.signal?.removeEventListener('abort', onAbort);
	}
}

function canServerCopy(source, destination) {
	return (
		source?.provider !== 'ftp' &&
		destination?.provider !== 'ftp' &&
		source?.endpoint &&
		source.endpoint === destination?.endpoint
	);
}

function shouldStreamInstead(error) {
	if (error?.status === 403) return true;

	return SERVER_COPY_FALLBACK.has(error?.code);
}

function probeObjectKey(destinationKey) {
	const name = `.bucket-lens-write-${randomBytes(8).toString('hex')}`;
	const slash = destinationKey.lastIndexOf('/');
	const dir = slash >= 0 ? destinationKey.slice(0, slash + 1) : '';
	const candidate = `${dir}${name}`;
	return candidate.length <= 1024 ? candidate : name;
}

function emptyBody(connection) {
	if (connection?.provider === 'ftp') return Readable.from([]);

	return Buffer.alloc(0);
}

function isMissing(error) {
	return error?.status === 404 || error?.code === 'NoSuchKey';
}

function isAccessDenied(error) {
	return (
		error?.status === 401 ||
		error?.status === 403 ||
		error?.code === 'AccessDenied' ||
		error?.code === 'AllAccessDisabled'
	);
}

function mapDenied(error, code) {
	if (!isAccessDenied(error)) return error;

	const message =
		code === 'SourceDenied' ? 'Source cannot be read' : 'Destination cannot be written';
	return new RequestError(403, code, message);
}

function mapWrite(error) {
	if (isAccessDenied(error) || error?.code === 'NoSuchKey') {
		return new RequestError(403, 'DestinationDenied', 'Destination cannot be written');
	}

	return error;
}

function canceled() {
	const error = new Error('canceled');
	error.name = 'CanceledError';
	error.code = 'ERR_CANCELED';
	return error;
}

function busy(jobs) {
	for (const job of jobs.values()) {
		if (job.status === 'checking' || job.status === 'copying') return true;
	}
	return false;
}

function prune(jobs) {
	const cutoff = Date.now() - 10 * 60 * 1000;
	for (const [id, job] of jobs) {
		if ((job.status === 'done' || job.status === 'error') && job.updated < cutoff)
			jobs.delete(id);
	}
}

function publicJob(job) {
	return {
		id: job.id,
		status: job.status,
		loaded: job.loaded,
		total: job.total,
		key: job.key,
		code: job.code,
		method: job.method,
	};
}
