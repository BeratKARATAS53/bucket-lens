import {
	Component,
	DestroyRef,
	ElementRef,
	HostListener,
	afterNextRender,
	computed,
	effect,
	inject,
	output,
	signal,
	viewChild,
} from '@angular/core';
import { classifyS3Error } from '../helpers/errors';
import { messageForError } from '../helpers/format';
import { Dictionary } from '../helpers/i18n';
import {
	PROVIDERS,
	ProviderId,
	defaultRegion,
	isKnownEndpoint,
	isProvider,
	normalizeEndpoint,
	providerLabelKey,
	regionById,
	regionFromKeyId,
	regionsFor,
} from '../helpers/regions';
import { ConnectionDraft, ConnectionView, S3Failure } from '../models/bucket';
import { ConnectionService } from '../services/connection.service';
import { I18nService } from '../services/i18n.service';
import { Icon } from './icon';

@Component({
	selector: 'app-settings-dialog',
	imports: [Icon],
	templateUrl: './settings-dialog.html',
})
export class SettingsDialog {
	readonly closed = output<void>();
	protected readonly i18n = inject(I18nService);
	protected readonly providers = PROVIDERS;
	protected readonly providerLabelKey = providerLabelKey;
	protected readonly regions = computed(() => regionsFor(this.draft().provider));
	protected readonly store = inject(ConnectionService);
	private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
	private readonly providerSelect = viewChild<ElementRef<HTMLSelectElement>>('providerSelect');
	private readonly regionSelect = viewChild<ElementRef<HTMLSelectElement>>('regionSelect');
	private readonly regionLocked = signal(false);
	private alive = true;

	protected readonly screen = signal<'list' | 'form'>(
		this.store.connections().length ? 'list' : 'form',
	);
	protected readonly editing = signal<ConnectionView | null>(null);
	protected readonly draft = signal<ConnectionDraft>(emptyDraft());
	protected readonly showSecret = signal(false);
	protected readonly submitted = signal(false);
	protected readonly saving = signal(false);
	protected readonly confirmDeleteId = signal<string | null>(null);
	protected readonly formError = signal<S3Failure | null>(null);
	protected readonly suggestion = computed(() =>
		this.draft().provider === 'backblaze' ? regionFromKeyId(this.draft().accessKeyId) : null,
	);
	protected readonly hasStoredSecret = computed(() => Boolean(this.editing()?.hasSecret));
	protected readonly errors = computed(() => {
		const draft = this.draft();
		const editing = this.editing();
		const sameKey = editing?.accessKeyId === draft.accessKeyId.trim();
		const secret = draft.secretAccessKey.trim() || (editing?.hasSecret && sameKey);
		const bucket = draft.bucket.trim();
		return {
			bucket: !bucket ? 'required' : /\s/.test(bucket) ? 'bucket' : null,
			endpoint: !normalizeEndpoint(draft.endpoint) ? 'required' : null,
			accessKeyId: !draft.accessKeyId.trim() ? 'required' : null,
			secret: !secret ? 'required' : null,
		} as const;
	});
	protected readonly valid = computed(() =>
		Object.values(this.errors()).every((error) => !error),
	);

	constructor() {
		inject(DestroyRef).onDestroy(() => {
			this.alive = false;
		});
		afterNextRender(() => this.panel()?.nativeElement.focus());
		effect(() => {
			const draft = this.draft();
			const providerSelect = this.providerSelect()?.nativeElement;
			if (providerSelect && providerSelect.value !== draft.provider) {
				providerSelect.value = draft.provider;
			}
			const regionSelect = this.regionSelect()?.nativeElement;
			if (regionSelect && regionSelect.value !== draft.region)
				regionSelect.value = draft.region;
		});
	}

	@HostListener('document:keydown.escape')
	protected onEscape(): void {
		if (this.saving()) return;
		if (this.screen() === 'form' && this.store.connections().length) {
			this.back();
			return;
		}
		this.closed.emit();
	}

	protected fieldError(
		field: 'bucket' | 'endpoint' | 'accessKeyId' | 'secret',
		t: Dictionary,
	): string | null {
		if (!this.submitted()) return null;
		const code = this.errors()[field];
		if (code === 'bucket') return t.validationBucket;
		if (code === 'required') return t.validationRequired;
		return null;
	}

	protected errorText(t: Dictionary): string {
		const error = this.formError();
		return error ? messageForError(error.kind, t) : '';
	}

	protected openCreate(): void {
		this.editing.set(null);
		this.regionLocked.set(false);
		this.submitted.set(false);
		this.formError.set(null);
		this.showSecret.set(false);
		this.confirmDeleteId.set(null);
		this.draft.set(emptyDraft());
		this.screen.set('form');
	}

	protected openEdit(item: ConnectionView, event: Event): void {
		event.stopPropagation();
		this.editing.set(item);
		this.regionLocked.set(true);
		this.submitted.set(false);
		this.formError.set(null);
		this.showSecret.set(false);
		this.confirmDeleteId.set(null);
		this.draft.set({
			id: item.id,
			provider: item.provider,
			region: item.region,
			endpoint: item.endpoint,
			bucket: item.bucket,
			accessKeyId: item.accessKeyId,
			secretAccessKey: '',
		});
		this.screen.set('form');
	}

	protected back(): void {
		this.submitted.set(false);
		this.formError.set(null);
		this.screen.set('list');
	}

	protected async choose(item: ConnectionView): Promise<void> {
		this.confirmDeleteId.set(null);
		if (this.saving() || this.store.config()?.id === item.id) return;
		this.saving.set(true);
		this.formError.set(null);
		try {
			await this.store.activate(item.id);
		} catch (error) {
			if (this.alive) this.formError.set(classifyS3Error(error));
		} finally {
			if (this.alive) this.saving.set(false);
		}
	}

	protected async remove(item: ConnectionView, event: Event): Promise<void> {
		event.stopPropagation();
		if (this.saving()) return;
		if (this.confirmDeleteId() !== item.id) {
			this.confirmDeleteId.set(item.id);
			return;
		}
		this.saving.set(true);
		this.formError.set(null);
		try {
			await this.store.remove(item.id);
			if (!this.alive) return;
			this.confirmDeleteId.set(null);
			if (!this.store.connections().length) this.openCreate();
		} catch (error) {
			if (this.alive) this.formError.set(classifyS3Error(error));
		} finally {
			if (this.alive) this.saving.set(false);
		}
	}

	protected onBucket(event: Event): void {
		this.patch({ bucket: valueFrom(event) });
	}

	protected onProvider(event: Event): void {
		const provider = providerFrom(valueFrom(event));
		const draft = this.draft();
		if (provider === draft.provider) return;
		const region = defaultRegion(provider);
		this.patch({
			provider,
			region: region.id,
			endpoint: isDefaultEndpoint(draft.endpoint) ? region.endpoint : draft.endpoint,
		});
	}

	protected onRegion(event: Event): void {
		const id = valueFrom(event);
		this.regionLocked.set(true);
		const region = regionById(this.draft().provider, id);
		const draft = this.draft();
		const endpointIsDefault = isDefaultEndpoint(draft.endpoint);
		this.patch({
			region: id,
			endpoint: endpointIsDefault && region ? region.endpoint : draft.endpoint,
		});
	}

	protected onEndpoint(event: Event): void {
		this.patch({ endpoint: valueFrom(event) });
	}

	protected onAccessKey(event: Event): void {
		const accessKeyId = valueFrom(event);
		const draft = this.draft();
		const guess = draft.provider === 'backblaze' ? regionFromKeyId(accessKeyId) : null;
		if (!guess || this.regionLocked()) {
			this.patch({ accessKeyId });
			return;
		}
		const region = regionById(draft.provider, guess);
		this.patch({
			accessKeyId,
			region: guess,
			endpoint:
				region && isDefaultEndpoint(draft.endpoint) ? region.endpoint : draft.endpoint,
		});
	}

	protected onSecret(event: Event): void {
		this.patch({ secretAccessKey: valueFrom(event) });
	}

	protected applySuggestion(): void {
		const guess = this.suggestion();
		if (!guess) return;
		this.regionLocked.set(true);
		const region = regionById(this.draft().provider, guess);
		const draft = this.draft();
		this.patch({
			region: guess,
			endpoint:
				region && isDefaultEndpoint(draft.endpoint) ? region.endpoint : draft.endpoint,
		});
	}

	protected async save(event: Event): Promise<void> {
		event.preventDefault();
		this.submitted.set(true);
		this.formError.set(null);
		if (!this.valid() || this.saving()) return;
		this.saving.set(true);
		try {
			await this.store.save({ ...this.draft(), id: this.editing()?.id });
			if (!this.alive) return;
			this.closed.emit();
		} catch (error) {
			if (!this.alive) return;
			this.formError.set(classifyS3Error(error));
		} finally {
			if (this.alive) this.saving.set(false);
		}
	}

	private patch(partial: Partial<ConnectionDraft>): void {
		this.confirmDeleteId.set(null);
		this.draft.update((draft) => ({ ...draft, ...partial }));
	}
}

function emptyDraft(): ConnectionDraft {
	const region = defaultRegion('backblaze');
	return {
		provider: 'backblaze',
		region: region.id,
		endpoint: region.endpoint,
		bucket: '',
		accessKeyId: '',
		secretAccessKey: '',
	};
}

function providerFrom(value: string): ProviderId {
	return isProvider(value) ? value : 'backblaze';
}

function valueFrom(event: Event): string {
	const target = event.target;
	return target instanceof HTMLInputElement || target instanceof HTMLSelectElement
		? target.value
		: '';
}

function isDefaultEndpoint(endpoint: string): boolean {
	const normalized = normalizeEndpoint(endpoint);
	return !normalized || isKnownEndpoint(normalized);
}
