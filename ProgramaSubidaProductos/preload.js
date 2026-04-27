const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  seleccionarExcel: () => ipcRenderer.invoke("seleccionar-excel"),
});
