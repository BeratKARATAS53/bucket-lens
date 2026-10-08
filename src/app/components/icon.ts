import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { fileKind } from '../helpers/format';
import { BucketEntry } from '../models/bucket';

export type IconName =
	| 'folder'
	| 'file'
	| 'image'
	| 'video'
	| 'audio'
	| 'document'
	| 'archive'
	| 'search'
	| 'settings'
	| 'sun'
	| 'moon'
	| 'download'
	| 'close'
	| 'refresh'
	| 'copy'
	| 'check'
	| 'alert'
	| 'eye'
	| 'eyeOff'
	| 'back'
	| 'chevronUp'
	| 'chevronDown'
	| 'bucket'
	| 'pencil'
	| 'trash'
	| 'plus';

const ICONS: Record<IconName, string> = {
	folder: '<path d="M3 7.5A2 2 0 0 1 5 5.5h4l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
	file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
	image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.2"/><path d="m21 15-4.5-4.5L7 19"/>',
	video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m11 9 5 3-5 3z"/>',
	audio: '<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2.5"/><circle cx="17" cy="16" r="2.5"/>',
	document:
		'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M8 13h8M8 17h5"/>',
	archive: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M12 12v4M10 14h4"/>',
	search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
	settings:
		'<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="8" cy="7" r="1.6" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="10" cy="17" r="1.6" fill="currentColor" stroke="none"/>',
	sun: '<circle cx="12" cy="12" r="3.5"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
	moon: '<path d="M20 14.5A7.5 7.5 0 1 1 9.5 4 6 6 0 0 0 20 14.5z"/>',
	download: '<path d="M12 4v10M8 10l4 4 4-4M5 19h14"/>',
	close: '<path d="M6 6l12 12M18 6 6 18"/>',
	refresh: '<path d="M20 12a8 8 0 1 1-2.2-5.5"/><path d="M20 4v5h-5"/>',
	copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5h10"/>',
	check: '<path d="m5 12 5 5L20 7"/>',
	alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
	eye: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>',
	eyeOff: '<path d="M3 3l18 18"/><path d="M10.5 6.2A10 10 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.2 3.8"/><path d="M6.2 6.7C3.7 8.4 2 12 2 12s4 6 10 6a10 10 0 0 0 4.2-.9"/>',
	back: '<path d="M15 6 9 12l6 6"/>',
	chevronUp: '<path d="m6 14 6-6 6 6"/>',
	chevronDown: '<path d="m6 10 6 6 6-6"/>',
	bucket: '<path d="M4 8c0-2 16-2 16 0v8c0 2-16 2-16 0z"/><path d="M4 8c0 2 16 2 16 0"/>',
	pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/>',
	trash: '<path d="M4 7h16M9 7V5h6v2M8 7l1 12h6l1-12"/>',
	plus: '<path d="M12 5v14M5 12h14"/>',
};

@Component({
	selector: 'app-icon',
	host: { class: 'inline-flex shrink-0' },
	template: `<span class="inline-flex size-full" [innerHTML]="markup()"></span>`,
})
export class Icon {
	readonly name = input.required<IconName>();
	private readonly sanitizer = inject(DomSanitizer);
	readonly markup: ReturnType<typeof computed<SafeHtml>> = computed(() =>
		this.sanitizer.bypassSecurityTrustHtml(
			`<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[this.name()]}</svg>`,
		),
	);
}

export function iconForEntry(entry: BucketEntry): IconName {
	if (entry.kind === 'folder') return 'folder';
	switch (fileKind(entry.name)) {
		case 'image':
			return 'image';
		case 'video':
			return 'video';
		case 'audio':
			return 'audio';
		case 'document':
			return 'document';
		case 'archive':
			return 'archive';
		default:
			return 'file';
	}
}
