import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const releaseApi = 'https://api.github.com/repos/BeratKARATAS53/bucket-lens/releases/latest';
const releaseRoots = [
	'https://github.com/beratkaratas53/bucket-lens/releases',
	'https://github.com/beratkaratas53/bucketlens/releases',
];

export function readAppVersion() {
	const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
	const parsed = JSON.parse(readFileSync(file, 'utf8'));
	return typeof parsed.version === 'string' ? parsed.version : '0.0.0';
}

export async function lookupGitHubRelease(signal) {
	const response = await fetch(releaseApi, {
		headers: {
			Accept: 'application/vnd.github+json',
			'User-Agent': 'bucket-lens',
		},
		signal,
	});
	if (!response.ok) return null;
	const body = await response.json();
	return {
		version: typeof body.tag_name === 'string' ? body.tag_name : '',
		url: typeof body.html_url === 'string' ? body.html_url : '',
	};
}

export async function checkForUpdate(current, lookup) {
	try {
		const latest = await lookup(AbortSignal.timeout(8000));
		return describeRelease(current, latest);
	} catch {
		return { current, latest: null, url: null };
	}
}

export function describeRelease(current, latest) {
	const version = normalizeVersion(latest?.version);
	const url = releasePage(latest?.url);
	if (!version || !url || !isNewer(version, current)) {
		return { current, latest: null, url: null };
	}
	return { current, latest: version, url };
}

export function isNewer(latest, current) {
	const next = versionParts(latest);
	const now = versionParts(current);
	if (!next || !now) return false;
	for (let index = 0; index < 3; index += 1) {
		if (next[index] !== now[index]) return next[index] > now[index];
	}
	return false;
}

function normalizeVersion(value) {
	const parts = versionParts(value);
	return parts ? parts.join('.') : null;
}

function versionParts(value) {
	if (typeof value !== 'string') return null;
	const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value.trim());
	if (!match) return null;
	return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function releasePage(value) {
	if (typeof value !== 'string') return null;
	let url;
	try {
		url = new URL(value);
	} catch {
		return null;
	}
	if (url.protocol !== 'https:' || url.username || url.password) return null;
	const page = `${url.origin}${url.pathname}`.toLowerCase();
	const allowed = releaseRoots.some((root) => page === root || page.startsWith(`${root}/`));
	if (!allowed) return null;
	return url.origin + url.pathname;
}
