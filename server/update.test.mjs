import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { startServer } from './index.mjs';
import { describeRelease, isNewer } from './update.mjs';

const page = 'https://github.com/BeratKARATAS53/BucketLens/releases/tag/v0.2.0';

test('a newer release is reported and the same release stays quiet', () => {
	assert.equal(isNewer('0.2.0', '0.1.0'), true);
	assert.equal(isNewer('v0.1.10', '0.1.9'), true);
	assert.equal(isNewer('0.1.0', '0.1.0'), false);
	assert.equal(isNewer('0.1.0', '0.2.0'), false);
	assert.deepEqual(describeRelease('0.1.0', { version: 'v0.2.0', url: page }), {
		current: '0.1.0',
		latest: '0.2.0',
		url: page,
	});
	assert.deepEqual(describeRelease('0.2.0', { version: 'v0.2.0', url: page }), {
		current: '0.2.0',
		latest: null,
		url: null,
	});
	assert.deepEqual(
		describeRelease('0.1.0', { version: '0.2.0', url: 'https://example.com/release' }),
		{ current: '0.1.0', latest: null, url: null },
	);
});

test('the update route returns the release page only when a newer version exists', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'bucket-lens-update-'));
	const server = await startServer({
		port: 0,
		dataDir: dir,
		version: '0.1.0',
		releaseLookup: async () => ({ version: 'v0.2.0', url: page }),
	});
	try {
		const port = server.address().port;
		const newer = await fetch(`http://127.0.0.1:${port}/api/update`);
		assert.equal(newer.status, 200);
		assert.deepEqual(await newer.json(), {
			current: '0.1.0',
			latest: '0.2.0',
			url: page,
		});
	} finally {
		await close(server);
		await rm(dir, { recursive: true, force: true });
	}
});

test('a release check that cannot reach GitHub stays quiet', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'bucket-lens-update-'));
	const server = await startServer({
		port: 0,
		dataDir: dir,
		version: '0.1.0',
		releaseLookup: async () => {
			throw new Error('offline');
		},
	});
	try {
		const port = server.address().port;
		const response = await fetch(`http://127.0.0.1:${port}/api/update`);
		assert.deepEqual(await response.json(), {
			current: '0.1.0',
			latest: null,
			url: null,
		});
	} finally {
		await close(server);
		await rm(dir, { recursive: true, force: true });
	}
});

function close(server) {
	return new Promise((resolve, reject) => {
		server.close((error) => (error ? reject(error) : resolve()));
	});
}
