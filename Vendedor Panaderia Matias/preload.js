const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getRuntimeInfo: () => ({
    platform: process.platform,
    versions: process.versions
  }),
  printTicket: (data) => ipcRenderer.invoke('print-ticket', data),
  toggleFullScreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getPrinters: () => ipcRenderer.invoke('get-printers')
});
