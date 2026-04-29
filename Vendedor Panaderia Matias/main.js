const path = require('path');
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

try {
  const configPath = path.join(__dirname, 'cajero.yml');
  if (fs.existsSync(configPath)) {
    fs.copyFileSync(configPath, path.join(__dirname, 'dev-app-update.yml'));
    fs.copyFileSync(configPath, path.join(__dirname, 'app-update.yml'));
  }
} catch (e) {
  console.error("Error configurando archivos de actualizacion:", e);
}

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await autoUpdater.checkForUpdatesAndNotify();
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-external', async (event, url) => {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    await shell.openExternal(url);
  }
});

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#f3efe6',
    icon: path.join(__dirname, 'assets/icon.ico'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src/renderer/index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
}

function resolveAppAsset(...segments) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...segments);
  }

  return path.join(__dirname, ...segments);
}

function resolvePrinterExecutable() {
  const resourcePath = resolveAppAsset('scripts', 'printer.exe');
  if (fs.existsSync(resourcePath)) return resourcePath;

  const unpackedPath = path
    .join(__dirname, 'scripts', 'printer.exe')
    .replace('app.asar', 'app.asar.unpacked');
  if (fs.existsSync(unpackedPath)) return unpackedPath;

  return path.join(__dirname, 'scripts', 'printer.exe');
}

function tryParsePrinterResult(rawText) {
  const text = String(rawText || '').trim();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      try {
        return JSON.parse(lines[i]);
      } catch {}
    }
  }

  return null;
}

ipcMain.handle('toggle-fullscreen', async () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    const isFS = win.isFullScreen();
    win.setFullScreen(!isFS);
    return !isFS;
  }
  return false;
});

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('get-printers', async () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (win) {
      try {
        return await win.webContents.getPrintersAsync();
      } catch (e) {
        console.error('Error al obtener impresoras:', e);
        return [];
      }
    }
    return [];
  });

  ipcMain.handle('print-ticket', async (event, ticketData = {}) => {
    return new Promise((resolve) => {
      // Ruta al script de Python
      let scriptPath = resolvePrinterExecutable();

      // Si la app estÃ¡ empaquetada, el binario se encuentra en app.asar.unpacked
      if (scriptPath.includes('app.asar')) {
        scriptPath = scriptPath.replace('app.asar', 'app.asar.unpacked');
      }

      try {
        if (!fs.existsSync(scriptPath)) {
          resolve({ success: false, error: `No se encontro printer.exe en: ${scriptPath}` });
          return;
        }

        // Ejecutar el proceso binario compilado
        const pythonProcess = spawn(scriptPath, []);

        let outputData = '';
        let errorData = '';

        pythonProcess.stdout.on('data', (data) => {
          outputData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          errorData += data.toString();
        });

        pythonProcess.on('error', (err) => {
          console.error('Fallo crÃ­tico al invocar printer.exe:', err);
          resolve({ success: false, error: `No se pudo iniciar el proceso de impresiÃ³n: ${err.message}` });
        });

        pythonProcess.on('close', (code) => {
          const parsedResult = tryParsePrinterResult(outputData);
          if (parsedResult && typeof parsedResult.success === 'boolean') {
            resolve(parsedResult);
            return;
          }

          if (code === 0) {
            resolve({ success: true, message: 'Ticket enviado a impresora.' });
            return;
          }

          console.error(`Printer process exited with code ${code}. Error: ${errorData}`);
          resolve({ success: false, error: errorData || `Error de ejecucion (codigo ${code})` });
        });

        // Enviar datos vÃ­a stdin en formato JSON
        pythonProcess.stdin.write(JSON.stringify({
          ...ticketData,
          logo_path: resolveAppAsset('src', 'renderer', 'assets', 'logo.png'),
          fecha: new Date().toLocaleString('es-CL') // Asegurar fecha local si no viene
        }));
        pythonProcess.stdin.end();
      } catch (err) {
        console.error('ExcepciÃ³n al spawnear printer.exe:', err);
        resolve({ success: false, error: `ExcepciÃ³n al lanzar proceso de impresiÃ³n: ${err.message}` });
      }
    });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

