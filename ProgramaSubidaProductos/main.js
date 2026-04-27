const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const XLSX = require("xlsx");

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 980,
    minHeight: 760,
    backgroundColor: "#f5efe4",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile("index.html");
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("seleccionar-excel", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Archivos Excel", extensions: ["xlsx", "xls"] }],
  });

  if (canceled || filePaths.length === 0) {
    return { canceled: true };
  }

  const filePath = filePaths[0];
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false,
  });

  return {
    canceled: false,
    filePath,
    sheetName,
    totalFilas: rows.length,
    columnas: rows.length > 0 ? Object.keys(rows[0]) : [],
    preview: rows.slice(0, 10),
    rows,
  };
});
