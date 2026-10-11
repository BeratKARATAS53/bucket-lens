import { Injectable, InjectionToken } from '@angular/core';
import { BucketEntry, ConnectionView, ListPage, ObjectMeta } from '../models/bucket';
import { BucketService } from '../services/bucket.service';
import { ConnectionService } from '../services/connection.service';

export const DEMO_MODE = new InjectionToken<boolean>('DEMO_MODE');

const demoConnection: ConnectionView = {
	id: 'demo',
	provider: 's3',
	region: 'eu-central-1',
	endpoint: 'demo.bucketlens.local',
	bucket: 'sample-bucket',
	accessKeyId: '',
	hasSecret: false,
};

const files: {
	key: string;
	size: number;
	lastModified: string;
	contentType: string;
}[] = [
	{ key: 'photos/shore.jpg', size: 2_401_122, lastModified: '2026-06-12T09:24:00.000Z', contentType: 'image/jpeg' },
	{ key: 'photos/kitchen.png', size: 1_844_320, lastModified: '2026-05-02T18:11:00.000Z', contentType: 'image/png' },
	{ key: 'photos/trip/sunset.webp', size: 980_441, lastModified: '2026-07-19T16:40:00.000Z', contentType: 'image/webp' },
	{ key: 'videos/intro.mp4', size: 48_221_004, lastModified: '2026-03-08T11:02:00.000Z', contentType: 'video/mp4' },
	{ key: 'audio/voice-note.mp3', size: 3_204_118, lastModified: '2026-04-21T08:16:00.000Z', contentType: 'audio/mpeg' },
	{ key: 'documents/agreement.pdf', size: 220_418, lastModified: '2026-01-14T13:45:00.000Z', contentType: 'application/pdf' },
	{ key: 'documents/notes.txt', size: 4_096, lastModified: '2026-02-02T10:00:00.000Z', contentType: 'text/plain' },
	{ key: 'documents/report.docx', size: 88_320, lastModified: '2026-08-01T15:30:00.000Z', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
	{ key: 'archives/backup.zip', size: 12_440_900, lastModified: '2025-12-20T07:55:00.000Z', contentType: 'application/zip' },
	{ key: 'readme.md', size: 1_240, lastModified: '2026-09-03T12:00:00.000Z', contentType: 'text/markdown' },
];

@Injectable()
export class DemoConnectionService extends ConnectionService {
	constructor() {
		super();
		this.connections.set([demoConnection]);
		this.config.set(demoConnection);
		this.ready.set(true);
	}

	override async load(): Promise<void> {
		return Promise.resolve();
	}

	override async save(): Promise<void> {
		return Promise.resolve();
	}

	override async activate(): Promise<void> {
		return Promise.resolve();
	}

	override async remove(): Promise<void> {
		return Promise.resolve();
	}
}

@Injectable()
export class DemoBucketService extends BucketService {
	override async list(prefix: string, token: string | null, delimited: boolean): Promise<ListPage> {
		if (token) return { entries: [], nextToken: null, scanned: 0 };
		const entries = delimited ? children(prefix) : nestedFiles(prefix);
		return { entries, nextToken: null, scanned: entries.length };
	}

	override async meta(key: string): Promise<ObjectMeta> {
		const file = files.find((item) => item.key === key);
		return {
			contentType: file?.contentType ?? null,
			size: file?.size ?? null,
			etag: 'demo',
			lastModified: file?.lastModified ?? null,
			storageClass: 'STANDARD',
		};
	}

	override async download(): Promise<void> {
		return Promise.resolve();
	}
}

function children(prefix: string): BucketEntry[] {
	const folders = new Map<string, BucketEntry>();
	const direct: BucketEntry[] = [];
	for (const file of files) {
		if (!file.key.startsWith(prefix)) continue;
		const rest = file.key.slice(prefix.length);
		const slash = rest.indexOf('/');
		if (slash === -1) {
			direct.push(fileEntry(file, prefix));
			continue;
		}
		const name = rest.slice(0, slash);
		const key = `${prefix}${name}/`;
		if (!folders.has(key)) folders.set(key, folderEntry(key, prefix));
	}
	return [...folders.values(), ...direct];
}

function nestedFiles(prefix: string): BucketEntry[] {
	return files.filter((file) => file.key.startsWith(prefix)).map((file) => fileEntry(file, prefix));
}

function fileEntry(
	file: (typeof files)[number],
	prefix: string,
): BucketEntry {
	const relative = file.key.slice(prefix.length);
	return {
		kind: 'file',
		key: file.key,
		name: nameOf(relative),
		relative,
		size: file.size,
		lastModified: file.lastModified,
		etag: 'demo',
		storageClass: 'STANDARD',
	};
}

function folderEntry(key: string, prefix: string): BucketEntry {
	const relative = key.slice(prefix.length);
	return {
		kind: 'folder',
		key,
		name: nameOf(relative),
		relative,
		size: null,
		lastModified: null,
		etag: null,
		storageClass: null,
	};
}

function nameOf(relative: string): string {
	const parts = relative.split('/').filter(Boolean);
	return parts.at(-1) || relative;
}
