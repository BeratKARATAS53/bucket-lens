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

export function createKeystore() {
	return {
		async readSecret(account) {
			try {
				return entry(account).getPassword();
			} catch (error) {
				throw new KeystoreError('The operating system keystore is unavailable.', error);
			}
		},
		async writeSecret(account, secret) {
			try {
				entry(account).setPassword(secret);
			} catch (error) {
				throw new KeystoreError('The operating system keystore is unavailable.', error);
			}
		},
		async deleteSecret(account) {
			try {
				entry(account).deletePassword();
			} catch (error) {
				throw new KeystoreError('The operating system keystore is unavailable.', error);
			}
		},
	};
}
