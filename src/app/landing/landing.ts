import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../components/icon';
import { Dictionary } from '../helpers/i18n';
import { I18nService } from '../services/i18n.service';
import { ThemeService } from '../services/theme.service';
import { SiteFooter } from '../site/footer';
import { SiteHeader } from '../site/header';

const release =
	'https://github.com/BeratKARATAS53/BucketLens/releases/latest/download';

type DownloadId = 'windows' | 'deb' | 'appimage';
type FaqAnswer = keyof Dictionary | readonly (keyof Dictionary)[];
type Platform = 'windows' | 'linux' | 'mac' | 'other';

const downloads: { id: DownloadId; platform: Platform; href: string }[] = [
	{
		id: 'windows',
		platform: 'windows',
		href: `${release}/bucket-lens-windows-x64.exe`,
	},
	{
		id: 'deb',
		platform: 'linux',
		href: `${release}/bucket-lens-linux-amd64.deb`,
	},
	{
		id: 'appimage',
		platform: 'linux',
		href: `${release}/bucket-lens-linux-x64.AppImage`,
	},
];

@Component({
	selector: 'app-landing',
	imports: [RouterLink, Icon, SiteHeader, SiteFooter],
	templateUrl: './landing.html',
	styleUrl: '../app.css',
})
export class Landing {
	protected readonly i18n = inject(I18nService);
	private readonly theme = inject(ThemeService);
	protected readonly preview = computed(
		() => `preview-${this.i18n.lang()}-${this.theme.mode()}.png`,
	);
	protected readonly releases = 'https://github.com/BeratKARATAS53/BucketLens/releases';
	protected readonly platform = detectPlatform();
	protected readonly downloads = [...downloads].sort(
		(left, right) => Number(right.platform === this.platform) - Number(left.platform === this.platform),
	);
	protected readonly faqs: { q: keyof Dictionary; a: FaqAnswer }[] = [
		{ q: 'faqUse', a: 'faqUseA' },
		{
			q: 'faqActions',
			a: [
				'faqActionsList',
				'faqActionsUpload',
				'faqActionsConflict',
				'faqActionsLink',
				'faqActionsDelete',
			],
		},
		{ q: 'faqSystems', a: 'faqSystemsA' },
		{ q: 'faqPrice', a: 'faqPriceA' },
		{ q: 'faqKey', a: 'faqKeyA' },
		{ q: 'faqDemo', a: 'faqDemoA' },
		{ q: 'faqSmart', a: 'faqSmartA' },
	];
	protected readonly openFaq = signal<keyof Dictionary | null>('faqUse');

	protected toggleFaq(id: keyof Dictionary): void {
		this.openFaq.update((current) => (current === id ? null : id));
	}

	protected paragraph(answer: FaqAnswer): keyof Dictionary | null {
		return typeof answer === 'string' ? answer : null;
	}

	protected lines(answer: FaqAnswer): readonly (keyof Dictionary)[] | null {
		return typeof answer === 'string' ? null : answer;
	}

	protected label(id: DownloadId): string {
		const t = this.i18n.t();
		if (id === 'windows') return t.landingWindows;
		if (id === 'deb') return t.landingDeb;

		return t.landingAppImage;
	}

	protected hint(id: DownloadId): string {
		const t = this.i18n.t();
		if (id === 'windows') return t.landingWindowsHint;
		if (id === 'deb') return t.landingDebHint;

		return t.landingAppImageHint;
	}

	protected primary(id: DownloadId): boolean {
		return (
			(id === 'windows' && this.platform === 'windows') ||
			(id === 'deb' && this.platform === 'linux')
		);
	}
}

function detectPlatform(): Platform {
	const ua = navigator.userAgent;
	if (/Windows/i.test(ua)) return 'windows';
	if (/Mac OS|Macintosh/i.test(ua)) return 'mac';
	if (/Linux/i.test(ua)) return 'linux';

	return 'other';
}
