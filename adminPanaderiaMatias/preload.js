const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getRuntimeInfo: () => ({
    platform: process.platform,
    versions: process.versions
  })
});
