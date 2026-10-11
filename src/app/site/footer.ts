import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { around, Dictionary } from '../helpers/i18n';
import { I18nService } from '../services/i18n.service';

@Component({
	selector: 'app-site-footer',
	imports: [RouterLink, RouterLinkActive],
	templateUrl: './footer.html',
})
export class SiteFooter {
	protected readonly i18n = inject(I18nService);
	protected readonly site = 'https://berat-karatas.com';
	protected readonly author = 'D. Berat KARATAŞ';
	protected readonly around = around;
	protected readonly links: { path: string; label: keyof Dictionary }[] = [
		{ path: '/icerik', label: 'footerContent' },
		{ path: '/kvkk', label: 'footerKvkk' },
		{ path: '/gizlilik', label: 'footerPrivacy' },
		{ path: '/kosullar', label: 'footerTerms' },
	];
}
