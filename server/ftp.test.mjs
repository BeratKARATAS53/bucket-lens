import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import {
	ftpJoin,
	ftpPort,
	listFtp,
	normalizeFtpHost,
	normalizeFtpRoot,
	probeFtpRead,
	putFtp,
	removeFtp,
} from './ftp.mjs';

test('ftp host, port, and folder are normalized', () => {
	assert.equal(normalizeFtpHost('ftp://files.example.com/public'), 'files.example.com');
	assert.equal(ftpPort('21'), 21);
	assert.equal(ftpPort('0'), null);
	assert.equal(ftpPort('70000'), null);
	assert.equal(normalizeFtpRoot(''), '/');
	assert.equal(normalizeFtpRoot('/public/html/'), 'public/html');
	assert.equal(normalizeFtpRoot('public/../html'), null);
	assert.equal(ftpJoin('/', 'docs/'), 'docs');
	assert.equal(ftpJoin('public', 'docs/a.txt'), 'public/docs/a.txt');
});

test('an ftp listing becomes folders and files', async () => {
	const page = await listFtp(connection(), '', null, true, 10, undefined, async () =>
		clientFor({
			'': [
				item('docs', true),
				item('..', true),
				item('a.txt', false, 4, new Date('2024-01-02T03:04:05Z')),
				item('link', true, 0, null, true),
			],
		}),
	);

	assert.equal(page.nextToken, null);
	assert.deepEqual(
		page.entries.map((entry) => [entry.kind, entry.key, entry.name, entry.size]),
		[
			['folder', 'docs/', 'docs', null],
			['file', 'a.txt', 'a.txt', 4],
			['file', 'link', 'link', 0],
		],
	);
	assert.equal(page.entries[1].lastModified, '2024-01-02T03:04:05.000Z');
});

test('a deep ftp listing walks folders and can resume', async () => {
	const tree = {
		'': [item('docs', true), item('a.txt', false, 1)],
		docs: [item('b.txt', false, 2)],
	};
	const connect = async () => clientFor(tree);
	const first = await listFtp(connection(), '', null, false, 1, undefined, connect);
	assert.equal(first.entries.length, 1);
	assert.equal(first.entries[0].key, 'docs/');
	assert.ok(first.nextToken);

	const second = await listFtp(connection(), '', first.nextToken, false, 1, undefined, connect);
	assert.equal(second.entries[0].key, 'a.txt');

	const third = await listFtp(connection(), '', second.nextToken, false, 10, undefined, connect);
	assert.deepEqual(
		third.entries.map((entry) => entry.key),
		['docs/b.txt'],
	);
	assert.equal(third.entries[0].relative, 'docs/b.txt');
	assert.equal(third.nextToken, null);
});

test('ftp upload writes the stream at the joined path', async () => {
	let remote = '';
	let text = '';
	await putFtp(connection(), 'docs/a.txt', Readable.from(['hello']), async () => ({
		async uploadFrom(source, path) {
			remote = path;
			const chunks = [];
			for await (const chunk of source) chunks.push(Buffer.from(chunk));
			text = Buffer.concat(chunks).toString('utf8');
		},
		close() {},
	}));
	assert.equal(remote, 'docs/a.txt');
	assert.equal(text, 'hello');
});

test('ftp read permission uses size and falls back to the first byte', async () => {
	let sized = 0;
	await probeFtpRead(connection(), 'docs/a.txt', async () => ({
		async size() {
			sized += 1;
		},
		downloadTo() {
			throw new Error('should not download');
		},
		close() {},
	}));
	assert.equal(sized, 1);

	let downloaded = 0;
	await probeFtpRead(connection(), 'docs/a.txt', async () => ({
		async size() {
			const error = new Error('500 unsupported');
			error.code = 500;
			throw error;
		},
		downloadTo(stream) {
			downloaded += 1;
			stream.end();
		},
		close() {},
	}));
	assert.equal(downloaded, 1);

	await assert.rejects(
		() =>
			probeFtpRead(connection(), 'docs/a.txt', async () => ({
				async size() {
					const error = new Error('550 denied');
					error.code = 550;
					throw error;
				},
				downloadTo() {
					const error = new Error('550 denied');
					error.code = 550;
					throw error;
				},
				close() {},
			})),
		(error) => error.code === 'AccessDenied',
	);
});

test('ftp delete removes the joined path', async () => {
	let remote = '';
	await removeFtp(connection(), 'docs/a.txt', async () => ({
		async remove(path) {
			remote = path;
		},
		close() {},
	}));
	assert.equal(remote, 'docs/a.txt');
});

test('ftp upload rejects a path that leaves the folder', async () => {
	await assert.rejects(
		() =>
			putFtp(connection(), '../secret.txt', Readable.from(['x']), async () => {
				throw new Error('should not connect');
			}),
		(error) => error.code === 'InvalidKey',
	);
});

test('a path that leaves the ftp folder is rejected', async () => {
	await assert.rejects(
		() =>
			listFtp(connection(), '../secret', null, true, 10, undefined, async () =>
				clientFor({}),
			),
		(error) => error.code === 'InvalidKey',
	);
});

function connection() {
	return {
		provider: 'ftp',
		region: '21',
		endpoint: 'files.example.com',
		bucket: '/',
		accessKeyId: 'anonymous',
		secretAccessKey: '',
		secure: false,
	};
}

function clientFor(tree) {
	return {
		async list(path = '') {
			const key = String(path).replace(/^\/+|\/+$/g, '');
			if (!Object.hasOwn(tree, key)) {
				const error = new Error('550 missing');
				error.code = 550;
				throw error;
			}
			return tree[key];
		},
		close() {},
	};
}

function item(name, directory, size = 0, modifiedAt = null, symbolicLink = false) {
	return {
		name,
		isDirectory: directory && !symbolicLink,
		isSymbolicLink: symbolicLink,
		size,
		modifiedAt,
	};
}
