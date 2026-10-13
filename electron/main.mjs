import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import { startServer } from '../server/index.mjs';

let downloadLocked = false;

ipcMain.on('download-lock', (event, locked) => {
	downloadLocked = Boolean(locked);
	const win = BrowserWindow.fromWebContents(event.sender);
	if (win && !win.isDestroyed()) win.setClosable(!downloadLocked);
});

if (!app.requestSingleInstanceLock()) {
	app.quit();
} else {
	let mainWindow = null;
	let server = null;

	app.on('second-instance', () => {
		if (!mainWindow) return;
		if (mainWindow.isMinimized()) mainWindow.restore();
		mainWindow.focus();
	});

	app.whenReady().then(async () => {
		try {
			const staticRoot = join(app.getAppPath(), 'dist', 'bucket-lens', 'browser');
			server = await startServer({
				port: 0,
				host: '127.0.0.1',
				staticRoot,
				dataDir: app.getPath('userData'),
			});
			const address = server.address();
			mainWindow = new BrowserWindow({
				width: 1280,
				height: 800,
				minWidth: 900,
				minHeight: 640,
				title: 'Bucket Lens',
				autoHideMenuBar: true,
				backgroundColor: '#efeae1',
				icon: join(staticRoot, 'icon.png'),
				webPreferences: {
					preload: join(app.getAppPath(), 'electron', 'preload.cjs'),
					contextIsolation: true,
					nodeIntegration: false,
					sandbox: true,
				},
			});
			mainWindow.on('close', (event) => {
				if (downloadLocked) event.preventDefault();
			});
			mainWindow.webContents.setWindowOpenHandler(({ url }) => {
				if (isReleasePage(url)) void shell.openExternal(url);
				return { action: 'deny' };
			});
			await mainWindow.loadURL(`http://127.0.0.1:${address.port}/app?desktop`);
		} catch (error) {
			dialog.showErrorBox(
				'Bucket Lens',
				error instanceof Error ? error.message : 'The app could not start.',
			);
			app.quit();
		}
	});

	app.on('before-quit', (event) => {
		if (downloadLocked) {
			event.preventDefault();
			return;
		}

		server?.close();
	});

	app.on('window-all-closed', () => {
		app.quit();
	});
}

const releaseRoots = [
	'https://github.com/beratkaratas53/bucket-lens/releases',
	'https://github.com/beratkaratas53/bucketlens/releases',
];

function isReleasePage(value) {
	try {
		const url = new URL(value);
		const page = `${url.origin}${url.pathname}`.toLowerCase();
		return (
			url.protocol === 'https:' &&
			!url.username &&
			!url.password &&
			releaseRoots.some((root) => page === root || page.startsWith(`${root}/`))
		);
	} catch {
		return false;
	}
}
