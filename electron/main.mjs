import { app, BrowserWindow, dialog, shell } from 'electron';
import { join } from 'node:path';
import { startServer } from '../server/index.mjs';

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
				icon: join(staticRoot, 'logo.png'),
				webPreferences: {
					contextIsolation: true,
					nodeIntegration: false,
					sandbox: true,
				},
			});
			mainWindow.webContents.setWindowOpenHandler(({ url }) => {
				if (url.startsWith('https://github.com/BeratKARATAS53/BucketLens/releases')) {
					void shell.openExternal(url);
				}
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

	app.on('before-quit', () => {
		server?.close();
	});

	app.on('window-all-closed', () => {
		app.quit();
	});
}
