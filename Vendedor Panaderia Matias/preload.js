const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getRuntimeInfo: () => ({
    platform: process.platform,
    versions: process.versions
  }),
  printTicket: (data) => ipcRenderer.invoke('print-ticket', data)
});
