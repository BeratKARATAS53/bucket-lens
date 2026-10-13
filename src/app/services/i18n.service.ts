import { Injectable, computed, effect, signal } from '@angular/core';
import { readStorage, writeStorage } from '../helpers/browser-storage';
import { Lang, translations } from '../helpers/i18n';

const LANG_KEY = 'bucket-lens.lang';

@Injectable({ providedIn: 'root' })
export class I18nService {
	readonly lang = signal<Lang>(this.read());
	readonly t = computed(() => translations[this.lang()]);

	constructor() {
		effect(() => {
			const lang = this.lang();
			document.documentElement.lang = lang;
			document.title = translations[lang].appTitle;
			writeStorage(LANG_KEY, lang);
		});
	}

	set(lang: Lang): void {
		this.lang.set(lang);
	}

	private read(): Lang {
		const stored = readStorage(LANG_KEY);
		if (stored === 'tr' || stored === 'en') return stored;

		return navigator.language.toLowerCase().startsWith('tr') ? 'tr' : 'en';
	}
}
