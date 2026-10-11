import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { KeystoreError } from './keystore.mjs';
import { createConnectionStore } from './store.mjs';

test('secrets stay in the keystore and leave the connection file', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'bucket-lens-store-'));
	const filePath = join(dir, 'connection.json');
	const secrets = new Map();
	const store = createConnectionStore({ filePath, keystore: memoryKeystore(secrets) });
	const secret = 'super-secret-value';

	await store.writeStore({
		activeId: 'one',
		connections: [
			{
				id: 'one',
				provider: 's3',
				region: 'us-east-1',
				endpoint: 's3.us-east-1.amazonaws.com',
				bucket: 'photos',
				accessKeyId: 'AKIAEXAMPLE',
				secretAccessKey: secret,
			},
		],
	});

	const onDisk = await readFile(filePath, 'utf8');
	assert.equal(onDisk.includes(secret), false);
	assert.equal(onDisk.includes('secretAccessKey'), false);
	assert.equal(secrets.get('one'), secret);

	const loaded = await store.readStore();
	assert.equal(loaded.connections[0].secretAccessKey, secret);
	await rm(dir, { recursive: true, force: true });
});

test('a legacy plaintext file is moved into the keystore', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'bucket-lens-store-'));
	const filePath = join(dir, 'connection.json');
	const secret = 'legacy-secret-value';
	await writeFile(
		filePath,
		`${JSON.stringify({
			provider: 'backblaze',
			region: 'us-west-004',
			endpoint: 's3.us-west-004.backblazeb2.com',
			bucket: 'archive',
			accessKeyId: '004example',
			secretAccessKey: secret,
		})}\n`,
	);
	const secrets = new Map();
	const store = createConnectionStore({ filePath, keystore: memoryKeystore(secrets) });
	const loaded = await store.readStore();
	const onDisk = await readFile(filePath, 'utf8');

	assert.equal(loaded.connections[0].secretAccessKey, secret);
	assert.equal(secrets.get(loaded.activeId), secret);
	assert.equal(onDisk.includes(secret), false);
	await rm(dir, { recursive: true, force: true });
});

test('plaintext remains on disk when the keystore cannot take it', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'bucket-lens-store-'));
	const filePath = join(dir, 'connection.json');
	const secret = 'kept-on-disk';
	await writeFile(
		filePath,
		`${JSON.stringify({
			provider: 'wasabi',
			region: 'eu-central-1',
			endpoint: 's3.eu-central-1.wasabisys.com',
			bucket: 'docs',
			accessKeyId: 'WASABIEXAMPLE',
			secretAccessKey: secret,
		})}\n`,
	);
	const store = createConnectionStore({
		filePath,
		keystore: {
			async readSecret() {
				throw new KeystoreError('down');
			},
			async writeSecret() {
				throw new KeystoreError('down');
			},
			async deleteSecret() {
				throw new KeystoreError('down');
			},
		},
	});
	const loaded = await store.readStore();
	const onDisk = await readFile(filePath, 'utf8');
	assert.equal(loaded.connections[0].secretAccessKey, secret);
	assert.equal(onDisk.includes(secret), true);
	await rm(dir, { recursive: true, force: true });
});

function memoryKeystore(secrets) {
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
