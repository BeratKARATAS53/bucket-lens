import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Entry } from '@napi-rs/keyring';

const service = 'bucket-lens';

export class KeystoreError extends Error {
	constructor(message, cause) {
		super(message);
		this.name = 'KeystoreError';
		this.code = 'KeystoreUnavailable';
		if (cause) this.cause = cause;
	}
}

function entry(account) {
	const options =
		process.platform === 'linux' ? { linux: { store: 'secret-service' } } : undefined;
	return new Entry(service, account, options);
}

async function readSecretsFile(filePath) {
	try {
		const parsed = JSON.parse(await readFile(filePath, 'utf8'));
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch (error) {
		if (error && error.code === 'ENOENT') return {};

		throw error;
	}
}

async function writeSecretsFile(filePath, secrets) {
	await mkdir(dirname(filePath), { recursive: true });
	const temporary = `${filePath}.tmp`;
	await writeFile(temporary, `${JSON.stringify(secrets, null, 2)}\n`, { mode: 0o600 });
	try {
		await rename(temporary, filePath);
	} catch (error) {
		if (process.platform !== 'win32') throw error;
		await rm(filePath, { force: true });
		await rename(temporary, filePath);
	}
}

export function createKeystore({ secretsFile = null } = {}) {
	return {
		async readSecret(account) {
			try {
				const secret = entry(account).getPassword();
				if (secret) return secret;
			} catch (error) {
				if (!secretsFile) {
					throw new KeystoreError('The operating system keystore is unavailable.', error);
				}
			}
			if (!secretsFile) {
				throw new KeystoreError('The operating system keystore is unavailable.');
			}

			const secrets = await readSecretsFile(secretsFile);
			return typeof secrets[account] === 'string' ? secrets[account] : null;
		},
		async writeSecret(account, secret) {
			try {
				entry(account).setPassword(secret);
				return;
			} catch (error) {
				if (!secretsFile) {
					throw new KeystoreError('The operating system keystore is unavailable.', error);
				}
			}
			if (!secretsFile) {
				throw new KeystoreError('The operating system keystore is unavailable.');
			}

			const secrets = await readSecretsFile(secretsFile);
			secrets[account] = secret;
			await writeSecretsFile(secretsFile, secrets);
		},
		async deleteSecret(account) {
			try {
				entry(account).deletePassword();
			} catch (error) {
				if (!secretsFile) {
					throw new KeystoreError('The operating system keystore is unavailable.', error);
				}
			}
			if (!secretsFile) return;

			const secrets = await readSecretsFile(secretsFile);
			if (!(account in secrets)) return;

			delete secrets[account];
			if (Object.keys(secrets).length) {
				await writeSecretsFile(secretsFile, secrets);
				return;
			}
			await rm(secretsFile, { force: true });
		},
	};
}
