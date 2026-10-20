import assert from 'node:assert/strict';
import { test } from 'node:test';
import { objectStats, objectUrlForTests } from './s3.mjs';

test('path-style providers build bucket URLs', () => {
	const r2 = {
		provider: 'r2',
		region: 'auto',
		endpoint: 'abc123.r2.cloudflarestorage.com',
		bucket: 'photos',
		accessKeyId: 'key',
		secretAccessKey: 'secret',
	};
	assert.equal(
		objectUrlForTests(r2, '/trip/sunset.webp'),
		'https://abc123.r2.cloudflarestorage.com/photos/trip/sunset.webp',
	);

	const minio = {
		provider: 'minio',
		region: 'us-east-1',
		endpoint: 'localhost:9000',
		bucket: 'data',
		accessKeyId: 'minio',
		secretAccessKey: 'minio123',
	};
	assert.equal(
		objectUrlForTests(minio, '/readme.txt'),
		'http://localhost:9000/data/readme.txt',
	);
});

test('object stats count nested files under a prefix', async () => {
	const pages = [
		{
			entries: [
				{
					kind: 'file',
					key: 'docs/a.txt',
					size: 4,
					lastModified: '2024-01-02T03:04:05.000Z',
				},
				{ kind: 'folder', key: 'docs/more/', size: null, lastModified: null },
			],
			nextToken: 'more',
		},
		{
			entries: [
				{
					kind: 'file',
					key: 'docs/more/b.txt',
					size: 8,
					lastModified: '2024-02-01T00:00:00.000Z',
				},
			],
			nextToken: null,
		},
	];
	let calls = 0;
	const connection = { provider: 's3', region: 'us-east-1', endpoint: 's3.amazonaws.com' };
	const stats = await objectStats(connection, 'docs/', undefined, async () => {
		const page = pages[calls];
		calls += 1;
		return page ?? { entries: [], nextToken: null };
	});

	assert.equal(stats.fileCount, 2);
	assert.equal(stats.totalBytes, 12);
	assert.equal(stats.lastModified, '2024-02-01T00:00:00.000Z');
	assert.equal(calls, 2);
});
