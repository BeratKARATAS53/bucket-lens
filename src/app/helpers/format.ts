import { Dictionary, Lang } from './i18n';
import { BucketEntry, FileKind, KindFilter, S3ErrorKind, SortDir, SortKey } from '../models/bucket';

const EXTENSIONS: Record<Exclude<FileKind, 'other'>, readonly string[]> = {
	image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'heic', 'bmp', 'ico'],
	video: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v'],
	audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'opus'],
	document: [
		'pdf',
		'doc',
		'docx',
		'xls',
		'xlsx',
		'ppt',
		'pptx',
		'txt',
		'md',
		'csv',
		'json',
		'rtf',
		'odt',
	],
	archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz'],
};

const FILTER_TO_KIND: Record<Exclude<KindFilter, 'all' | 'folders'>, FileKind> = {
	images: 'image',
	videos: 'video',
	audio: 'audio',
	documents: 'document',
	archives: 'archive',
	other: 'other',
};

export function extensionOf(name: string): string {
	const base = name.split('/').pop() ?? name;
	const dot = base.lastIndexOf('.');
	if (dot <= 0) return '';
	return base.slice(dot + 1).toLowerCase();
}

export function fileKind(name: string): FileKind {
	const extension = extensionOf(name);
	for (const kind of Object.keys(EXTENSIONS) as Exclude<FileKind, 'other'>[]) {
		if (EXTENSIONS[kind].includes(extension)) return kind;
	}
	return 'other';
}

export function matchesFilter(entry: BucketEntry, filter: KindFilter): boolean {
	if (filter === 'all') return true;
	if (filter === 'folders') return entry.kind === 'folder';
	if (entry.kind === 'folder') return false;
	return fileKind(entry.name) === FILTER_TO_KIND[filter];
}

export function kindLabel(entry: BucketEntry, t: Dictionary): string {
	if (entry.kind === 'folder') return t.kindFolder;
	switch (fileKind(entry.name)) {
		case 'image':
			return t.kindImage;
		case 'video':
			return t.kindVideo;
		case 'audio':
			return t.kindAudio;
		case 'document':
			return t.kindDocument;
		case 'archive':
			return t.kindArchive;
		default:
			return t.kindOther;
	}
}

export function messageForError(kind: S3ErrorKind, t: Dictionary): string {
	const messages: Record<S3ErrorKind, string> = {
		offline: t.errorOffline,
		forbidden: t.errorForbidden,
		notFound: t.errorNotFound,
		missing: t.errorMissing,
		signature: t.errorSignature,
		keystore: t.errorKeystore,
		unreachable: t.errorUnreachable,
		generic: t.errorGeneric,
	};
	return messages[kind];
}

export function formatBytes(bytes: number | null, lang: Lang): string {
	if (bytes == null || Number.isNaN(bytes)) return '—';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	const digits = unit === 0 || value >= 10 ? 0 : 1;
	const formatted = new Intl.NumberFormat(locale(lang), {
		maximumFractionDigits: digits,
		minimumFractionDigits: digits,
	}).format(value);
	return `${formatted} ${units[unit]}`;
}

export function formatExact(bytes: number | null, lang: Lang): string {
	if (bytes == null || Number.isNaN(bytes)) return '—';
	const formatted = new Intl.NumberFormat(locale(lang)).format(bytes);
	return lang === 'tr' ? `${formatted} bayt` : `${formatted} bytes`;
}

export function formatCount(count: number, lang: Lang): string {
	const formatted = new Intl.NumberFormat(locale(lang)).format(count);
	if (lang === 'tr') return `${formatted} öğe`;
	return count === 1 ? '1 item' : `${formatted} items`;
}

export function formatScanned(count: number, lang: Lang): string {
	const formatted = new Intl.NumberFormat(locale(lang)).format(count);
	return lang === 'tr' ? `${formatted} nesne tarandı` : `${formatted} objects scanned`;
}

export function formatDate(value: string | null, lang: Lang, style: 'short' | 'full'): string {
	if (!value) return '—';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '—';
	return new Intl.DateTimeFormat(
		locale(lang),
		style === 'short'
			? {
					day: 'numeric',
					month: 'short',
					year: 'numeric',
					hour: '2-digit',
					minute: '2-digit',
				}
			: { dateStyle: 'medium', timeStyle: 'short' },
	).format(date);
}

export function sortEntries(
	entries: readonly BucketEntry[],
	key: SortKey,
	dir: SortDir,
	lang: Lang,
	labelOf: (entry: BucketEntry) => string,
): BucketEntry[] {
	const sign = dir === 'asc' ? 1 : -1;
	const collator = new Intl.Collator(locale(lang), { sensitivity: 'base', numeric: true });
	return [...entries].sort((a, b) => {
		if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
		let compared = 0;
		if (key === 'size') compared = (a.size ?? -1) - (b.size ?? -1);
		else if (key === 'modified')
			compared = (a.lastModified ?? '').localeCompare(b.lastModified ?? '');
		else compared = collator.compare(labelOf(a), labelOf(b));
		return compared * sign;
	});
}

function locale(lang: Lang): string {
	return lang === 'tr' ? 'tr-TR' : 'en-GB';
}
