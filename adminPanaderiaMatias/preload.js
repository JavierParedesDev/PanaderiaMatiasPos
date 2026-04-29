const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getRuntimeInfo: () => ({
    platform: process.platform,
    versions: process.versions
  }),
  enviarPluBalanza: (payload) => ipcRenderer.invoke('scale:send-plu', payload)
});
