export interface ConnectionView {
	id: string;
	provider: 'backblaze' | 'wasabi' | 's3';
	region: string;
	endpoint: string;
	bucket: string;
	accessKeyId: string;
	hasSecret: boolean;
}

export interface ConnectionList {
	activeId: string | null;
	connections: ConnectionView[];
}

export interface ConnectionDraft {
	id?: string;
	provider: 'backblaze' | 'wasabi' | 's3';
	region: string;
	endpoint: string;
	bucket: string;
	accessKeyId: string;
	secretAccessKey: string;
}

export interface BucketEntry {
	kind: 'folder' | 'file';
	key: string;
	name: string;
	relative: string;
	size: number | null;
	lastModified: string | null;
	etag: string | null;
	storageClass: string | null;
}

export interface ListPage {
	entries: BucketEntry[];
	nextToken: string | null;
	scanned?: number;
}

export interface ObjectMeta {
	contentType: string | null;
	size: number | null;
	etag: string | null;
	lastModified: string | null;
	storageClass: string | null;
}

export type KindFilter =
	'all' | 'folders' | 'images' | 'videos' | 'audio' | 'documents' | 'archives' | 'other';

export type SortKey = 'name' | 'size' | 'modified';
export type SortDir = 'asc' | 'desc';
export type FileKind = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';
export type S3ErrorKind =
	| 'offline'
	| 'forbidden'
	| 'notFound'
	| 'missing'
	| 'signature'
	| 'keystore'
	| 'generic';

export interface S3Failure {
	kind: S3ErrorKind;
	code: string | null;
}
