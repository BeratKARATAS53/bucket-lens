import { Routes } from '@angular/router';
import { demoProviders } from './demo/providers';

const legal = (id: 'content' | 'kvkk' | 'privacy' | 'terms') => ({
	data: { id },
	loadComponent: () => import('./legal/legal').then((module) => module.LegalPage),
});

export const routes: Routes = [
	{
		path: '',
		loadComponent: () => import('./landing/landing').then((module) => module.Landing),
	},
	{ path: 'icerik', ...legal('content') },
	{ path: 'kvkk', ...legal('kvkk') },
	{ path: 'gizlilik', ...legal('privacy') },
	{ path: 'kosullar', ...legal('terms') },
	{
		path: 'demo',
		providers: demoProviders,
		loadComponent: () => import('./app').then((module) => module.App),
	},
	{
		path: 'app',
		loadComponent: () => import('./app').then((module) => module.App),
	},
];
