import { NgTemplateOutlet } from '@angular/common';
import {
	Component,
	DestroyRef,
	ElementRef,
	HostListener,
	computed,
	effect,
	inject,
	signal,
	untracked,
	viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { isCancel } from 'axios';
import { classifyS3Error } from './helpers/errors';
import {
	formatBytes,
	formatCount,
	formatDate,
	formatScanned,
	kindLabel,
	matchesFilter,
	messageForError,
	sortEntries,
} from './helpers/format';
import { providerLabelKey } from './helpers/regions';
import { BucketEntry, KindFilter, S3Failure, SortKey } from './models/bucket';
import { DetailDialog } from './components/detail-dialog';
import { Icon, iconForEntry } from './components/icon';
import { SettingsDialog } from './components/settings-dialog';
import { BucketService } from './services/bucket.service';
import { ConnectionService } from './services/connection.service';
import { I18nService } from './services/i18n.service';
import { ThemeService } from './services/theme.service';
import { DEMO_MODE } from './demo/demo';

@Component({
	selector: 'app-browser',
	imports: [NgTemplateOutlet, Icon, SettingsDialog, DetailDialog],
	templateUrl: './app.html',
	styleUrl: './app.css',
})
export class App {
	protected readonly demo = inject(DEMO_MODE, { optional: true }) === true;
	protected readonly i18n = inject(I18nService);
	protected readonly providerLabelKey = providerLabelKey;
	protected readonly theme = inject(ThemeService);
	protected readonly store = inject(ConnectionService);
	protected readonly iconFor = iconForEntry;
	protected readonly formatBytes = formatBytes;
	protected readonly formatDate = formatDate;
	protected readonly formatCount = formatCount;
	protected readonly formatScanned = formatScanned;
	protected readonly kindLabel = kindLabel;
	protected readonly messageForError = messageForError;
	protected readonly skeletons = [46, 32, 58, 40, 28, 52, 36, 44];
	protected readonly filters = [
		['all', 'filterAll'],
		['folders', 'filterFolders'],
		['images', 'filterImages'],
		['videos', 'filterVideos'],
		['audio', 'filterAudio'],
		['documents', 'filterDocuments'],
		['archives', 'filterArchives'],
		['other', 'filterOther'],
	] as const;

	protected readonly settingsOpen = signal(false);
	protected readonly selected = signal<BucketEntry | null>(null);
	protected readonly prefix = signal('');
	protected readonly query = signal('');
	protected readonly includeSubfolders = signal(false);
	protected readonly kind = signal<KindFilter>('all');
	protected readonly sortKey = signal<SortKey>('name');
	protected readonly sortDir = signal<'asc' | 'desc'>('asc');
	protected readonly entries = signal<BucketEntry[]>([]);
	protected readonly shown = signal(200);
	protected readonly token = signal<string | null>(null);
	protected readonly loading = signal(false);
	protected readonly loadingMore = signal(false);
	protected readonly scanned = signal(0);
	protected readonly error = signal<S3Failure | null>(null);

	private readonly appliedQuery = signal('');
	protected readonly searchMode = computed(() =>
		this.includeSubfolders() && this.appliedQuery().trim().length >= 2 ? 'deep' : 'folder',
	);
	protected readonly filtering = computed(
		() => this.query().trim().length > 0 || this.kind() !== 'all',
	);
	protected readonly queryPending = computed(
		() => this.query().trim() !== this.appliedQuery().trim(),
	);
	protected readonly scanning = computed(() => {
		if (!this.filtering() || this.error()) return false;
		return this.queryPending() || this.loading() || this.loadingMore();
	});
	protected readonly crumbs = computed(() => {
		const parts = this.prefix().split('/').filter(Boolean);
		return parts.map((name, index) => ({
			name,
			prefix: `${parts.slice(0, index + 1).join('/')}/`,
		}));
	});
	protected readonly visible = computed(() => {
		const lang = this.i18n.lang();
		const needle = this.appliedQuery()
			.trim()
			.toLocaleLowerCase(lang === 'tr' ? 'tr' : 'en');
		const filter = this.kind();
		const deep = this.searchMode() === 'deep';
		let list = this.entries();
		if (needle) {
			list = list.filter((entry) =>
				`${entry.name} ${entry.relative}`
					.toLocaleLowerCase(lang === 'tr' ? 'tr' : 'en')
					.includes(needle),
			);
		}
		if (filter !== 'all') list = list.filter((entry) => matchesFilter(entry, filter));
		return sortEntries(list, this.sortKey(), this.sortDir(), lang, (entry) =>
			this.rowLabel(entry, deep),
		);
	});
	protected readonly rendered = computed(() => this.visible().slice(0, this.shown()));

	private readonly bucket = inject(BucketService);
	private readonly searchBox = viewChild<ElementRef<HTMLInputElement>>('searchBox');
	private generation = 0;
	private listAbort: AbortController | null = null;
	private queryTimer: ReturnType<typeof setTimeout> | null = null;
	private activeConnectionId: string | null | undefined = undefined;

	constructor() {
		if (!this.demo && !isDesktopShell()) {
			void inject(Router).navigateByUrl('/demo', { replaceUrl: true });
			return;
		}
		void this.store.load();
		effect(() => {
			document.body.style.overflow = this.settingsOpen() || this.selected() ? 'hidden' : '';
		});
		effect(() => {
			const id = this.store.config()?.id ?? null;
			const previous = this.activeConnectionId;
			this.activeConnectionId = id;
			if (previous === undefined || previous === id) return;
			untracked(() => {
				this.prefix.set('');
				this.query.set('');
				this.appliedQuery.set('');
				this.includeSubfolders.set(false);
				this.kind.set('all');
			});
		});
		effect(() => {
			this.prefix();
			this.searchMode();
			this.appliedQuery();
			this.kind();
			this.store.config();
			this.store.ready();
			untracked(() => {
				void this.reload(true);
			});
		});
		inject(DestroyRef).onDestroy(() => {
			document.body.style.overflow = '';
			if (this.queryTimer) clearTimeout(this.queryTimer);
			this.listAbort?.abort();
		});
	}

	@HostListener('document:keydown', ['$event'])
	protected onKeydown(event: KeyboardEvent): void {
		if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
		if (this.settingsOpen() || this.selected()) return;
		const target = event.target;
		if (
			target instanceof HTMLInputElement ||
			target instanceof HTMLTextAreaElement ||
			target instanceof HTMLSelectElement
		) {
			return;
		}
		event.preventDefault();
		this.searchBox()?.nativeElement.focus();
	}

	protected rowLabel(entry: BucketEntry, deep = this.searchMode() === 'deep'): string {
		return deep ? entry.relative || entry.name : entry.name;
	}

	protected openSettings(): void {
		if (this.demo) return;
		this.selected.set(null);
		this.settingsOpen.set(true);
	}

	protected goHome(): void {
		this.selected.set(null);
		this.settingsOpen.set(false);
		if (this.store.config()) this.goTo('');
	}

	protected goTo(prefix: string): void {
		this.query.set('');
		this.includeSubfolders.set(false);
		this.kind.set('all');
		this.prefix.set(prefix);
	}

	protected goUp(): void {
		const parts = this.prefix().split('/').filter(Boolean);
		parts.pop();
		this.goTo(parts.length ? `${parts.join('/')}/` : '');
	}

	protected open(entry: BucketEntry): void {
		if (entry.kind === 'folder') {
			this.goTo(entry.key);
			return;
		}
		this.selected.set(entry);
	}

	protected onQuery(event: Event): void {
		if (!(event.target instanceof HTMLInputElement)) return;
		this.query.set(event.target.value);
		this.scheduleQuery(event.target.value);
	}

	protected clearQuery(): void {
		if (this.queryTimer) clearTimeout(this.queryTimer);
		this.queryTimer = null;
		this.listAbort?.abort();
		this.query.set('');
		this.appliedQuery.set('');
	}

	private scheduleQuery(value: string): void {
		if (this.queryTimer) clearTimeout(this.queryTimer);
		this.listAbort?.abort();
		if (!value.trim()) {
			this.queryTimer = null;
			this.appliedQuery.set('');
			return;
		}
		this.queryTimer = setTimeout(() => {
			this.queryTimer = null;
			this.appliedQuery.set(value);
		}, 300);
	}

	protected setKind(filter: KindFilter): void {
		this.kind.set(filter);
	}

	protected toggleSort(key: SortKey): void {
		if (this.sortKey() === key) {
			this.sortDir.update((dir) => (dir === 'asc' ? 'desc' : 'asc'));
			return;
		}
		this.sortKey.set(key);
		this.sortDir.set(key === 'name' ? 'asc' : 'desc');
	}

	protected setSortKey(event: Event): void {
		const value = event.target instanceof HTMLSelectElement ? event.target.value : '';
		if (value !== 'name' && value !== 'size' && value !== 'modified') return;
		if (this.sortKey() !== value) this.toggleSort(value);
	}

	protected refresh(): void {
		void this.reload(true);
	}

	protected loadMore(): void {
		if (this.filtering()) {
			this.shown.update((count) => count + 200);
			return;
		}
		if (!this.token() || this.loading() || this.loadingMore()) return;
		void this.reload(false);
	}

	private async reload(reset: boolean): Promise<void> {
		if (!this.store.ready()) return;
		if (!reset && !this.token()) return;
		const id = ++this.generation;
		this.listAbort?.abort();
		const abort = new AbortController();
		this.listAbort = abort;
		const cfg = this.store.config();
		const prefix = this.prefix();
		const deep = this.searchMode() === 'deep';
		if (!cfg) {
			this.entries.set([]);
			this.token.set(null);
			this.scanned.set(0);
			this.loading.set(false);
			this.loadingMore.set(false);
			this.error.set(null);
			return;
		}

		const query = this.appliedQuery().trim();
		const kind = this.kind();
		const broad = query.length > 0 || kind !== 'all';
		const filter = broad ? { q: query, kind, lang: this.i18n.lang() } : undefined;
		const startToken = reset ? null : this.token();
		if (reset) {
			this.loading.set(true);
			this.loadingMore.set(false);
			this.entries.set([]);
			this.token.set(null);
			this.scanned.set(0);
			this.shown.set(200);
			this.error.set(null);
		} else {
			this.loadingMore.set(true);
			this.error.set(null);
		}

		try {
			let next = startToken;
			let previous = startToken;
			let items = reset ? [] : this.entries();
			let seen = reset ? 0 : this.scanned();
			let pages = 0;
			do {
				const page = await this.bucket.list(
					prefix,
					next,
					!deep,
					broad ? 1000 : 200,
					filter,
					abort.signal,
				);
				if (id !== this.generation) return;
				items = items.concat(page.entries);
				seen += page.scanned ?? page.entries.length;
				previous = next;
				next = page.nextToken;
				pages += 1;
				this.scanned.set(seen);
				if (broad && items.length) this.entries.set(items);
				if (!next || next === previous || (!broad && pages >= 1)) break;
			} while (true);
			if (id !== this.generation) return;
			this.entries.set(items);
			this.token.set(next);
		} catch (error) {
			if (id !== this.generation || isCancel(error)) return;
			this.error.set(classifyS3Error(error));
		} finally {
			if (id === this.generation) {
				this.loading.set(false);
				this.loadingMore.set(false);
			}
		}
	}
}

function isDesktopShell(): boolean {
	const host = location.hostname;
	const local = host === '127.0.0.1' || host === 'localhost';
	return local && new URLSearchParams(location.search).has('desktop');
}
