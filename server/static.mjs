import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const types = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.webp': 'image/webp',
	'.txt': 'text/plain; charset=utf-8',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.map': 'application/json; charset=utf-8',
};

export async function serveStatic(root, pathname, res) {
	const file = safePath(root, pathname);
	if (!file) {
		notFound(res);
		return;
	}

	let target = file;
	try {
		const info = await stat(file);
		if (info.isDirectory()) target = safePath(root, `${pathname.replace(/\/$/, '')}/index.html`);
	} catch {
		target = extname(pathname) ? null : safePath(root, '/index.html');
	}

	if (!target) {
		notFound(res);
		return;
	}

	try {
		const body = await readFile(target);
		res.writeHead(200, {
			'content-type': types[extname(target)] ?? 'application/octet-stream',
			'cache-control': 'no-cache',
		});
		res.end(body);
	} catch {
		notFound(res);
	}
}

function safePath(root, pathname) {
	let decoded;
	try {
		decoded = decodeURIComponent(pathname);
	} catch {
		return null;
	}
	const rootPath = resolve(root);
	const relative = decoded.replace(/^[/\\]+/, '');
	const full = resolve(rootPath, relative);
	if (full !== rootPath && !full.startsWith(`${rootPath}${sep}`)) return null;
	return full;
}

function notFound(res) {
	res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
	res.end('Not found');
}
