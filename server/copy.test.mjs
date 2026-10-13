import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { COPY_LIMIT_BYTES, copyBetween, createCopyRunner } from './copy.mjs';
import { RequestError } from './request-error.mjs';
import { copySourceHeader } from './s3.mjs';

test('the copy source header keeps slashes and encodes the name', () => {
	assert.equal(copySourceHeader('photos', 'album/a file.txt'), '/photos/album/a%20file.txt');
});

test('a file over 1 GB is refused before anything is written', async () => {
	const { calls, io } = recorder();
	await assert.rejects(
		() =>
			copyBetween(source(), destination(), 'a.txt', 'a.txt', {
				io: {
					...io,
					async headObject() {
						calls.push('head');
						return { size: COPY_LIMIT_BYTES + 1, contentType: 'text/plain' };
					},
				},
			}),
		(error) => error.code === 'FileTooLarge',
	);
	assert.deepEqual(calls, ['head']);
});

test('a file of exactly 1 GB can be copied on the server', async () => {
	const { calls, io } = recorder({ size: COPY_LIMIT_BYTES });
	const result = await copyBetween(source(), destination(), 'a.txt', 'b.txt', { io });
	assert.equal(result.bytes, COPY_LIMIT_BYTES);
	assert.equal(result.method, 'server');
	assert.ok(calls.includes('server'));
});

test('the source read permission is checked before a write', async () => {
	const { calls, io } = recorder();
	await assert.rejects(
		() =>
			copyBetween(source(), destination(), 'a.txt', 'a.txt', {
				io: {
					...io,
					async headObject(connection) {
						calls.push(`head:${connection.id}`);
						if (connection.id === 'source') {
							throw new RequestError(403, 'AccessDenied', 'no');
						}
						throw new RequestError(404, 'NoSuchKey', 'missing');
					},
				},
			}),
		(error) => error.code === 'SourceDenied',
	);
	assert.deepEqual(calls, ['head:source']);
});

test('the destination write permission is checked with a probe that is removed', async () => {
	const { calls, io } = recorder();
	await assert.rejects(
		() =>
			copyBetween(source(), destination(), 'a.txt', 'folder/a.txt', {
				io: {
					...io,
					async putObject(_connection, key) {
						calls.push(`put:${key}`);
						throw new RequestError(403, 'AccessDenied', 'no');
					},
				},
			}),
		(error) => error.code === 'DestinationDenied',
	);
	assert.equal(calls.filter((call) => call === 'server' || call === 'download').length, 0);
	assert.match(calls.at(-1), /^put:folder\/\.bucket-lens-write-/);
});

test('an existing destination is left untouched unless overwrite is set', async () => {
	const blocked = recorder();
	await assert.rejects(
		() =>
			copyBetween(source(), destination(), 'a.txt', 'a.txt', {
				io: {
					...blocked.io,
					async headObject() {
						return { size: 4, contentType: 'text/plain' };
					},
				},
			}),
		(error) => error.code === 'DestinationExists',
	);
	assert.equal(blocked.calls.includes('put'), false);

	const replaced = recorder();
	const result = await copyBetween(source(), destination(), 'a.txt', 'a.txt', {
		overwrite: true,
		io: replaced.io,
	});
	assert.equal(result.key, 'a.txt');
	assert.ok(replaced.calls.includes('server'));
});

test('s3 buckets on the same endpoint use a server-side copy', async () => {
	const progress = [];
	const { calls, io } = recorder();
	const result = await copyBetween(source(), destination(), 'album/a.txt', 'album/a.txt', {
		io,
		onProgress(loaded, total) {
			progress.push([loaded, total]);
		},
	});
	assert.equal(result.method, 'server');
	assert.deepEqual(progress.at(-1), [4, 4]);
	assert.equal(calls.includes('download'), false);
	assert.equal(calls.includes('server'), true);
	assert.equal(calls.filter((call) => call.startsWith('delete:')).length, 1);
});

test('a denied server-side copy falls back to a local stream', async () => {
	const { calls, io } = recorder();
	const result = await copyBetween(source(), destination(), 'a.txt', 'a.txt', {
		io: {
			...io,
			async copyS3Object() {
				calls.push('server');
				throw new RequestError(403, 'AccessDenied', 'no');
			},
		},
	});
	assert.equal(result.method, 'stream');
	assert.ok(calls.includes('server'));
	assert.ok(calls.includes('download'));
	assert.ok(calls.includes('body:abcd'));
});

test('different endpoints and ftp servers stream the file through this computer', async () => {
	const remote = recorder();
	const streamed = await copyBetween(
		source({ endpoint: 's3.wasabisys.com' }),
		destination(),
		'a.txt',
		'a.txt',
		{ io: remote.io },
	);
	assert.equal(streamed.method, 'stream');
	assert.equal(remote.calls.includes('server'), false);

	const ftp = recorder();
	const copied = await copyBetween(
		source({ provider: 'ftp' }),
		destination({ provider: 'ftp' }),
		'docs/a.txt',
		'docs/a.txt',
		{
			io: ftp.io,
		},
	);
	assert.equal(copied.method, 'stream');
	assert.ok(ftp.calls.includes('read:source'));
	assert.ok(ftp.calls.includes('body:abcd'));
});

test('a short ftp upload is removed again', async () => {
	const { calls, io } = recorder();
	await assert.rejects(
		() =>
			copyBetween(source(), destination({ provider: 'ftp' }), 'a.txt', 'a.txt', {
				io: {
					...io,
					async openDownload() {
						calls.push('download');
						return { data: Readable.from([Buffer.from('ab')]) };
					},
				},
			}),
		(error) => error.code === 'SizeMismatch',
	);
	assert.ok(calls.includes('delete:dest:a.txt'));
});

test('the same connection cannot be the destination', async () => {
	const { calls, io } = recorder();
	await assert.rejects(
		() =>
			copyBetween(source({ id: 'only' }), destination({ id: 'only' }), 'a.txt', 'a.txt', {
				io,
			}),
		(error) => error.code === 'SameConnection',
	);
	assert.deepEqual(calls, []);
});

test('copy jobs report failures and can be canceled', async () => {
	const failing = createCopyRunner(async () => {
		throw new RequestError(413, 'FileTooLarge', 'big');
	});
	const failed = failing.start({
		source: source(),
		destination: destination(),
		sourceKey: 'a.txt',
		destinationKey: 'b.txt',
	});
	await settle();
	assert.equal(failing.get(failed.id).status, 'error');
	assert.equal(failing.get(failed.id).code, 'FileTooLarge');

	let release = () => {};
	const running = createCopyRunner(
		(_source, _destination, _sourceKey, _destinationKey, options) =>
			new Promise((resolve, reject) => {
				options.signal.addEventListener(
					'abort',
					() => reject(Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' })),
					{ once: true },
				);
				release = () => resolve({ key: 'b.txt', bytes: 1, method: 'stream' });
			}),
	);
	const job = running.start({
		source: source(),
		destination: destination(),
		sourceKey: 'a.txt',
		destinationKey: 'b.txt',
	});
	assert.throws(
		() =>
			running.start({
				source: source(),
				destination: destination(),
				sourceKey: 'a.txt',
				destinationKey: 'c.txt',
			}),
		(error) => error.code === 'CopyBusy',
	);
	assert.equal(running.cancel(job.id).code, 'Canceled');
	release();
	await settle();
	assert.equal(running.get(job.id).status, 'error');
	assert.equal(running.get(job.id).code, 'Canceled');
});

function source(overrides = {}) {
	return {
		id: 'source',
		provider: 's3',
		endpoint: 's3.example.com',
		bucket: 'photos',
		...overrides,
	};
}

function destination(overrides = {}) {
	return {
		id: 'dest',
		provider: 's3',
		endpoint: 's3.example.com',
		bucket: 'archive',
		...overrides,
	};
}

function recorder({ download = Readable.from([Buffer.from('abcd')]), size = 4 } = {}) {
	const calls = [];
	const io = {
		async headObject(connection, key) {
			calls.push(`head:${connection.id}:${key}`);
			if (connection.id === 'dest') throw new RequestError(404, 'NoSuchKey', 'missing');
			return { size, contentType: 'text/plain' };
		},
		async putObject(connection, key, body) {
			calls.push('put');
			if (String(key).includes('.bucket-lens-write-')) {
				calls.push(`probe:${connection.id}`);
				return;
			}
			if (body && typeof body.pipe === 'function') {
				const chunks = [];
				for await (const chunk of body) chunks.push(Buffer.from(chunk));
				calls.push(`body:${Buffer.concat(chunks).toString('utf8')}`);
			}
		},
		async deleteObject(connection, key) {
			calls.push(`delete:${connection.id}:${key}`);
		},
		async openDownload() {
			calls.push('download');
			return { data: download };
		},
		async copyS3Object() {
			calls.push('server');
		},
		async probeFtpRead(connection) {
			calls.push(`read:${connection.id}`);
		},
	};
	return { calls, io };
}

function settle() {
	return new Promise((resolve) => setImmediate(resolve));
}
