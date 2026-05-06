const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getRuntimeInfo: () => ({
    platform: process.platform,
    versions: process.versions
  }),
  enviarPluBalanza: (payload) => ipcRenderer.invoke('scale:send-plu', payload),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_event, info) => callback(info)),
  onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (_event, progress) => callback(progress)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_event, info) => callback(info)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (_event, error) => callback(error))
});
