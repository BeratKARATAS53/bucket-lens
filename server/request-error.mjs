export class RequestError extends Error {
	constructor(status, code, message) {
		super(message || code || 'Request failed');
		this.name = 'RequestError';
		this.status = status || 502;
		this.code = code || null;
	}
}
