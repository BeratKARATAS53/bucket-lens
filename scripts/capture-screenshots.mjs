/**
 * Captures marketing and README screenshots with an isolated empty key store.
 *
 *   pnpm build && pnpm screenshots
 */
import { access, mkdir, mkdtemp } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from '../server/index.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const staticRoot = join(root, 'dist', 'bucket-lens', 'browser');
const listViewport = { width: 1280, height: 800 };
const previewViewport = { width: 1186, height: 649 };

async function ensureBuild() {
	try {
		await access(join(staticRoot, 'index.html'));
	} catch {
		throw new Error('Run pnpm build before pnpm screenshots.');
	}
}

async function openPage(browser, base, { lang, theme }) {
	const context = await browser.newContext({ viewport: listViewport });
	await context.addInitScript(
		({ lang, theme }) => {
			localStorage.setItem('bucket-lens.lang', lang);
			localStorage.setItem('bucket-lens.theme', theme);
		},
		{ lang, theme },
	);
	const page = await context.newPage();
	return { context, page, base };
}

async function waitForApp(page) {
	await page.waitForSelector('app-browser', { timeout: 60_000 });
	await page.waitForTimeout(400);
}

async function capture(page, filePath, viewport = listViewport) {
	await page.setViewportSize(viewport);
	await page.waitForTimeout(200);
	await mkdir(dirname(filePath), { recursive: true });
	await page.screenshot({ path: filePath, type: 'png' });
}

async function demoList(page, base) {
	await page.goto(`${base}/demo`, { waitUntil: 'networkidle' });
	await waitForApp(page);
	await page.waitForSelector('.stats-row .stats-value', { timeout: 15_000 });
	await page.waitForFunction(
		() => document.querySelector('.stats-row')?.getAttribute('aria-busy') !== 'true',
		undefined,
		{ timeout: 15_000 },
	);
}

async function demoDetail(page, base) {
	await demoList(page, base);
	await page
		.locator('ul li button')
		.filter({ has: page.getByText('readme.md', { exact: true }) })
		.first()
		.click();
	await page.locator('#detail-title', { hasText: 'readme.md' }).waitFor({
		state: 'visible',
		timeout: 15_000,
	});
	await page.waitForTimeout(300);
}

async function desktopWelcome(page, base) {
	await page.goto(`${base}/app?desktop`, { waitUntil: 'networkidle' });
	await page.waitForSelector('app-browser', { timeout: 60_000 });
	await page.getByRole('button', { name: /Anahtar ekle|Add key/i }).waitFor({
		state: 'visible',
		timeout: 30_000,
	});
	await page.waitForTimeout(300);
}

async function desktopNewKey(page, base) {
	await desktopWelcome(page, base);
	await page.getByRole('button', { name: /Anahtar ekle|Add key/i }).click();
	await page.locator('#settings-title').waitFor({ state: 'visible', timeout: 15_000 });
	await page.locator('input[name="name"]').waitFor({ state: 'visible', timeout: 15_000 });
	await page.waitForTimeout(300);
}

async function main() {
	await ensureBuild();
	const dataDir = await mkdtemp(join(tmpdir(), 'bucket-lens-shots-'));
	const server = await startServer({
		port: 0,
		host: '127.0.0.1',
		staticRoot,
		dataDir,
	});
	const address = server.address();
	const base = `http://127.0.0.1:${address.port}`;

	const browser = await chromium.launch();
	try {
		for (const theme of ['light', 'dark']) {
			for (const lang of ['tr', 'en']) {
				const { context, page } = await openPage(browser, base, { lang, theme });
				await demoList(page, base);
				await capture(
					page,
					join(root, 'public', `preview-${lang}-${theme}.png`),
					previewViewport,
				);
				await context.close();
			}
		}

		const trLight = await openPage(browser, base, { lang: 'tr', theme: 'light' });
		await demoList(trLight.page, base);
		await capture(trLight.page, join(root, 'docs', 'liste.png'));
		await trLight.context.close();

		const trDetail = await openPage(browser, base, { lang: 'tr', theme: 'light' });
		await demoDetail(trDetail.page, base);
		await capture(trDetail.page, join(root, 'docs', 'ayrinti.png'));
		await trDetail.context.close();

		const trWelcome = await openPage(browser, base, { lang: 'tr', theme: 'light' });
		await desktopWelcome(trWelcome.page, base);
		await capture(trWelcome.page, join(root, 'docs', 'karsilama.png'));
		await trWelcome.context.close();

		const trKey = await openPage(browser, base, { lang: 'tr', theme: 'light' });
		await desktopNewKey(trKey.page, base);
		await capture(trKey.page, join(root, 'docs', 'baglanti.png'));
		await trKey.context.close();

		const enLight = await openPage(browser, base, { lang: 'en', theme: 'light' });
		await demoList(enLight.page, base);
		await capture(enLight.page, join(root, 'docs', 'en', 'list.png'));
		await enLight.context.close();

		const enDetail = await openPage(browser, base, { lang: 'en', theme: 'light' });
		await demoDetail(enDetail.page, base);
		await capture(enDetail.page, join(root, 'docs', 'en', 'detail.png'));
		await enDetail.context.close();

		const enWelcome = await openPage(browser, base, { lang: 'en', theme: 'light' });
		await desktopWelcome(enWelcome.page, base);
		await capture(enWelcome.page, join(root, 'docs', 'en', 'welcome.png'));
		await enWelcome.context.close();

		const enKey = await openPage(browser, base, { lang: 'en', theme: 'light' });
		await desktopNewKey(enKey.page, base);
		await capture(enKey.page, join(root, 'docs', 'en', 'connection.png'));
		await enKey.context.close();

		console.log('Screenshots written to public/ and docs/.');
	} finally {
		await browser.close();
		server.close();
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
