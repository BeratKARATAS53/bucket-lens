import { Component, inject, input } from '@angular/core';
import { Icon } from '../components/icon';
import { I18nService } from '../services/i18n.service';
import { ThemeService } from '../services/theme.service';

@Component({
	selector: 'app-site-header',
	imports: [Icon],
	templateUrl: './header.html',
})
export class SiteHeader {
	readonly logoHref = input('#download');
	protected readonly i18n = inject(I18nService);
	protected readonly theme = inject(ThemeService);
}
