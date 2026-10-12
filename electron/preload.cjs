const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bucketLens', {
	setDownloadLock(locked) {
		ipcRenderer.send('download-lock', Boolean(locked));
	},
});
