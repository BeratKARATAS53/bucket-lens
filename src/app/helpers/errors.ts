import { isAxiosError } from 'axios';
import { S3Failure } from '../models/bucket';

export function classifyS3Error(error: unknown): S3Failure {
	if (!isAxiosError(error)) return { kind: 'generic', code: null };
	if (!error.response) return { kind: 'offline', code: null };

	const data = error.response.data as { code?: string | null; message?: string } | undefined;
	const code = data?.code ?? null;
	const status = error.response.status;
	if (
		code === 'SignatureDoesNotMatch' ||
		code === 'RequestTimeTooSkewed' ||
		code === 'AuthorizationHeaderMalformed'
	) {
		return { kind: 'signature', code };
	}
	if (code === 'NoSuchKey') return { kind: 'missing', code };
	if (status === 404 || code === 'NoSuchBucket') return { kind: 'notFound', code };
	if (
		status === 401 ||
		status === 403 ||
		code === 'AccessDenied' ||
		code === 'InvalidAccessKeyId'
	) {
		return { kind: 'forbidden', code };
	}
	return { kind: 'generic', code: code || String(status) };
}
