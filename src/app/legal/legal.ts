import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { I18nService } from '../services/i18n.service';
import { SiteFooter } from '../site/footer';
import { SiteHeader } from '../site/header';
import { LegalId, legalDocuments } from './documents';

@Component({
	selector: 'app-legal',
	imports: [SiteHeader, SiteFooter],
	templateUrl: './legal.html',
	styleUrl: '../app.css',
})
export class LegalPage {
	private readonly i18n = inject(I18nService);
	private readonly id = toSignal(
		inject(ActivatedRoute).data.pipe(map((data) => data['id'] as LegalId)),
		{ requireSync: true },
	);
	protected readonly doc = computed(() => legalDocuments[this.i18n.lang()][this.id()]);
}
