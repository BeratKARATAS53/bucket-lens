import { Injectable, effect, signal } from '@angular/core';
import { readStorage, writeStorage } from '../helpers/browser-storage';

const THEME_KEY = 'bucket-lens.theme';
export type ThemeMode = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
	readonly mode = signal<ThemeMode>(this.read());

	constructor() {
		effect(() => {
			const dark = this.mode() === 'dark';
			document.documentElement.classList.toggle('dark', dark);
			document
				.querySelector('meta[name="theme-color"]')
				?.setAttribute('content', dark ? '#131512' : '#efeae1');
			writeStorage(THEME_KEY, this.mode());
		});
	}

	toggle(): void {
		this.mode.update((mode) => (mode === 'dark' ? 'light' : 'dark'));
	}

	private read(): ThemeMode {
		const stored = readStorage(THEME_KEY);
		if (stored === 'light' || stored === 'dark') return stored;

		return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	}
}
