import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { KeystoreError } from './keystore.mjs';
import { startServer } from './index.mjs';

test('the desktop server serves the interface and hides missing secrets', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'bucket-lens-web-'));
	const web = join(dir, 'web');
	const dataDir = join(dir, 'data');
	await mkdir(web);
	await writeFile(join(web, 'index.html'), '<!doctype html><title>Bucket Lens</title>');
	await writeFile(join(web, 'app.js'), 'console.log("bucket-lens")');
	const server = await startServer({
		port: 0,
		staticRoot: web,
		dataDir,
		keystore: memoryKeystore(),
	});
	try {
		const port = server.address().port;
		const page = await fetch(`http://127.0.0.1:${port}/`);
		assert.equal(page.status, 200);
		assert.match(await page.text(), /Bucket Lens/);
		const script = await fetch(`http://127.0.0.1:${port}/app.js`);
		assert.equal(script.headers.get('content-type'), 'text/javascript; charset=utf-8');
		const home = await fetch(`http://127.0.0.1:${port}/folders/2024`);
		assert.equal(home.status, 200);
		assert.match(await home.text(), /Bucket Lens/);
		const api = await fetch(`http://127.0.0.1:${port}/api/connection`);
		assert.deepEqual(await api.json(), { activeId: null, connections: [] });
		const missing = await fetch(`http://127.0.0.1:${port}/api/missing`);
		assert.equal(missing.status, 404);
		const escape = await fetch(`http://127.0.0.1:${port}/%2e%2e/%2e%2e/package.json`);
		assert.equal(escape.status, 404);
	} finally {
		await close(server);
		await rm(dir, { recursive: true, force: true });
	}
});

test('a missing keystore is reported when the secret is no longer on disk', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'bucket-lens-web-'));
	const server = await startServer({
		port: 0,
		dataDir: dir,
		keystore: {
			async readSecret() {
				throw new KeystoreError('The operating system keystore is unavailable.');
			},
			async writeSecret() {
				throw new KeystoreError('The operating system keystore is unavailable.');
			},
			async deleteSecret() {
				throw new KeystoreError('The operating system keystore is unavailable.');
			},
		},
	});
	try {
		await writeFile(
			join(dir, 'connection.json'),
			`${JSON.stringify({
				activeId: 'abc',
				connections: [
					{
						id: 'abc',
						provider: 's3',
						region: 'us-east-1',
						endpoint: 's3.us-east-1.amazonaws.com',
						bucket: 'photos',
						accessKeyId: 'AKIAEXAMPLE',
					},
				],
			})}\n`,
		);
		const port = server.address().port;
		const response = await fetch(`http://127.0.0.1:${port}/api/connection`);
		assert.equal(response.status, 503);
		assert.equal((await response.json()).code, 'KeystoreUnavailable');
	} finally {
		await close(server);
		await rm(dir, { recursive: true, force: true });
	}
});

test('an incomplete ftp connection is rejected before dialing', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'bucket-lens-web-'));
	const server = await startServer({ port: 0, dataDir: dir, keystore: memoryKeystore() });
	try {
		const port = server.address().port;
		const response = await fetch(`http://127.0.0.1:${port}/api/connection`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				provider: 'ftp',
				region: '21',
				endpoint: 'ftp://files.example.com/../../',
				bucket: '/public',
				accessKeyId: '',
				secretAccessKey: '',
			}),
		});
		assert.equal(response.status, 400);
		assert.equal((await response.json()).code, 'InvalidConnection');
	} finally {
		await close(server);
		await rm(dir, { recursive: true, force: true });
	}
});

test('upload and presign reject bad keys before opening a connection', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'bucket-lens-web-'));
	const server = await startServer({ port: 0, dataDir: dir, keystore: memoryKeystore() });
	try {
		const port = server.address().port;
		const upload = await fetch(
			`http://127.0.0.1:${port}/api/objects?key=${encodeURIComponent('../secret')}`,
			{
				method: 'PUT',
				headers: { 'content-type': 'text/plain', 'content-length': '4' },
				body: 'test',
			},
		);
		assert.equal(upload.status, 400);
		assert.equal((await upload.json()).code, 'InvalidKey');
		const missing = await fetch(`http://127.0.0.1:${port}/api/objects/presign?minutes=15`);
		assert.equal(missing.status, 400);
		assert.equal((await missing.json()).code, 'MissingKey');
		const duration = await fetch(
			`http://127.0.0.1:${port}/api/objects/presign?key=a.txt&minutes=45`,
		);
		assert.equal(duration.status, 400);
		assert.equal((await duration.json()).code, 'InvalidDuration');
	} finally {
		await close(server);
		await rm(dir, { recursive: true, force: true });
	}
});

test('a presigned url carries the chosen lifetime and ftp refuses it', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'bucket-lens-web-'));
	const server = await startServer({ port: 0, dataDir: dir, keystore: memoryKeystore() });
	try {
		await writeFile(
			join(dir, 'connection.json'),
			`${JSON.stringify({
				activeId: 's3',
				connections: [
					{
						id: 's3',
						provider: 's3',
						region: 'us-east-1',
						endpoint: 'example.invalid',
						bucket: 'photos',
						accessKeyId: 'AKIAEXAMPLE',
						secretAccessKey: 'secretsecretsecretsecretsecret12',
					},
				],
			})}\n`,
		);
		const port = server.address().port;
		const response = await fetch(
			`http://127.0.0.1:${port}/api/objects/presign?key=${encodeURIComponent('album/a file.txt')}&minutes=5`,
		);
		assert.equal(response.status, 200);
		const body = await response.json();
		assert.equal(body.expiresIn, 300);
		const signed = new URL(body.url);
		assert.equal(signed.hostname, 'photos.example.invalid');
		assert.equal(signed.pathname, '/album/a%20file.txt');
		assert.equal(signed.searchParams.get('X-Amz-Expires'), '300');
		assert.ok(signed.searchParams.get('X-Amz-Signature'));

		await writeFile(
			join(dir, 'connection.json'),
			`${JSON.stringify({
				activeId: 'ftp',
				connections: [
					{
						id: 'ftp',
						provider: 'ftp',
						region: '21',
						endpoint: 'files.example.com',
						bucket: '/',
						accessKeyId: 'anonymous',
						secretAccessKey: '',
						secure: false,
					},
				],
			})}\n`,
		);
		const ftp = await fetch(
			`http://127.0.0.1:${port}/api/objects/presign?key=a.txt&minutes=15`,
		);
		assert.equal(ftp.status, 400);
		assert.equal((await ftp.json()).code, 'PresignUnsupported');
	} finally {
		await close(server);
		await rm(dir, { recursive: true, force: true });
	}
});

test('a refused ftp server is reported', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'bucket-lens-web-'));
	const server = await startServer({ port: 0, dataDir: dir, keystore: memoryKeystore() });
	try {
		const port = server.address().port;
		const response = await fetch(`http://127.0.0.1:${port}/api/connection`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				provider: 'ftp',
				region: '1',
				endpoint: '127.0.0.1',
				bucket: '/',
				accessKeyId: 'anonymous',
				secretAccessKey: '',
				secure: false,
			}),
		});
		assert.equal(response.status, 502);
		assert.equal((await response.json()).code, 'FtpRefused');
	} finally {
		await close(server);
		await rm(dir, { recursive: true, force: true });
	}
});

test('a copy stays between saved connections and reports progress', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'bucket-lens-web-'));
	let release = () => {};
	const seen = [];
	const server = await startServer({
		port: 0,
		dataDir: dir,
		keystore: memoryKeystore(),
		copyBetween: (source, destination, sourceKey, destinationKey, options) =>
			new Promise((resolve, reject) => {
				seen.push([
					source.id,
					destination.id,
					sourceKey,
					destinationKey,
					options.overwrite,
				]);
				options.onProgress?.(2, 4);
				options.signal.addEventListener(
					'abort',
					() => reject(Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' })),
					{ once: true },
				);
				release = () => resolve({ key: destinationKey, bytes: 4, method: 'stream' });
			}),
	});
	try {
		await writeFile(join(dir, 'connection.json'), `${JSON.stringify(twoConnections())}\n`);
		const port = server.address().port;
		const missing = await fetch(`http://127.0.0.1:${port}/api/objects/copy`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ key: 'a.txt', destinationId: 'missing' }),
		});
		assert.equal(missing.status, 404);
		const same = await fetch(`http://127.0.0.1:${port}/api/objects/copy`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ key: 'a.txt', destinationId: 'source' }),
		});
		assert.equal(same.status, 400);
		assert.equal((await same.json()).code, 'SameConnection');
		const badKey = await fetch(`http://127.0.0.1:${port}/api/objects/copy`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ key: '../secret', destinationId: 'dest' }),
		});
		assert.equal(badKey.status, 400);
		assert.equal((await badKey.json()).code, 'InvalidKey');

		const started = await fetch(`http://127.0.0.1:${port}/api/objects/copy`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				key: '/album/a.txt',
				destinationId: 'dest',
				destinationKey: '/kept/a.txt',
				overwrite: true,
			}),
		});
		assert.equal(started.status, 202);
		const job = await started.json();
		assert.ok(job.status === 'checking' || job.status === 'copying');
		const busy = await fetch(`http://127.0.0.1:${port}/api/objects/copy`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ key: 'b.txt', destinationId: 'dest' }),
		});
		assert.equal(busy.status, 409);
		assert.equal((await busy.json()).code, 'CopyBusy');
		const progress = await fetch(`http://127.0.0.1:${port}/api/objects/copy?id=${job.id}`);
		assert.equal((await progress.json()).loaded, 2);
		release();
		const done = await waitForCopy(port, job.id);
		assert.equal(done.status, 'done');
		assert.equal(done.method, 'stream');
		assert.equal(done.key, 'kept/a.txt');
		assert.deepEqual(seen, [['source', 'dest', 'album/a.txt', 'kept/a.txt', true]]);

		const again = await fetch(`http://127.0.0.1:${port}/api/objects/copy`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ key: 'c.txt', destinationId: 'dest' }),
		});
		const second = await again.json();
		const canceled = await fetch(`http://127.0.0.1:${port}/api/objects/copy?id=${second.id}`, {
			method: 'DELETE',
		});
		assert.equal((await canceled.json()).code, 'Canceled');
		const unknown = await fetch(`http://127.0.0.1:${port}/api/objects/copy?id=missing`);
		assert.equal(unknown.status, 404);
	} finally {
		release();
		await close(server);
		await rm(dir, { recursive: true, force: true });
	}
});

function twoConnections() {
	return {
		activeId: 'source',
		connections: [
			{
				id: 'source',
				provider: 's3',
				region: 'us-east-1',
				endpoint: 's3.example.com',
				bucket: 'photos',
				accessKeyId: 'AKIAEXAMPLE',
				secretAccessKey: 'secretsecretsecretsecretsecret12',
			},
			{
				id: 'dest',
				provider: 'ftp',
				region: '21',
				endpoint: 'files.example.com',
				bucket: '/archive',
				accessKeyId: 'ada',
				secretAccessKey: 'secret',
				secure: false,
			},
		],
	};
}

async function waitForCopy(port, id) {
	for (let attempt = 0; attempt < 20; attempt += 1) {
		const response = await fetch(`http://127.0.0.1:${port}/api/objects/copy?id=${id}`);
		const body = await response.json();
		if (body.status === 'done' || body.status === 'error') return body;

		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	throw new Error('copy did not finish');
}

function memoryKeystore() {
	const secrets = new Map();
	return {
		async readSecret(id) {
			return secrets.has(id) ? secrets.get(id) : null;
		},
		async writeSecret(id, secret) {
			secrets.set(id, secret);
		},
		async deleteSecret(id) {
			secrets.delete(id);
		},
	};
}

function close(server) {
	return new Promise((resolve, reject) => {
		server.close((error) => (error ? reject(error) : resolve()));
	});
}
