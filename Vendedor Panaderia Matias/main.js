const path = require('path');
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

// Configuración de escalado para pantallas de alta resolución (DPI)
app.commandLine.appendSwitch('high-dpi-support', '1');
app.commandLine.appendSwitch('force-device-scale-factor', '1'); // Puedes comentar esto si prefieres que use el escalado de Windows

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
    return { 
      success: true, 
      updateInfo: result ? result.updateInfo : null 
    };
  } catch (error) {
    console.error("Error checking for updates:", error);
    return { success: false, error: error.message };
  }
});

autoUpdater.on('update-available', (info) => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('update-available', info);
});

autoUpdater.on('download-progress', (progressObj) => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('update-progress', progressObj);
});

autoUpdater.on('update-downloaded', (info) => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('update-downloaded', info);
});

autoUpdater.on('error', (err) => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('update-error', err.message);
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
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: '#f3efe6',
    icon: path.join(__dirname, 'assets/icon.ico'),
    show: false,
    autoHideMenuBar: true, // Asegura que la barra de menú no ocupe espacio
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true
    }
  });

  mainWindow.setMenu(null);

  // Habilitar shortcuts manuales (Ctrl+Shift+I y Ctrl+R) sin tener menú visible
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
    if (input.control && input.key.toLowerCase() === 'r') {
      mainWindow.webContents.reload();
      event.preventDefault();
    }
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
    if (input.key === 'F5') {
      mainWindow.webContents.reload();
      event.preventDefault();
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src/renderer/index.html'));
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
    mainWindow.focus();
  });
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

function resolvePrinterScript() {
  const scriptPath = resolveAppAsset('scripts', 'printer.py');
  if (fs.existsSync(scriptPath)) return scriptPath;
  return null;
}

function resolvePrinterCommand() {
  if (!app.isPackaged) {
    const scriptPath = resolvePrinterScript();
    if (scriptPath) {
      if (process.platform === 'win32') {
        return { command: 'py', args: ['-3', scriptPath] };
      }
      return { command: 'python3', args: [scriptPath] };
    }
  }

  return { command: resolvePrinterExecutable(), args: [] };
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
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (win) {
    const isFS = win.isFullScreen();
    win.setFullScreen(!isFS);
    // En Windows, a veces es necesario forzar el foco tras cambiar a FS
    if (!isFS) {
      win.focus();
    }
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
      const { command, args } = resolvePrinterCommand();
      let scriptPath = command;
      const usesInterpreter = ['py', 'python', 'python3'].includes(command);

      // Si la app estÃ¡ empaquetada, el binario se encuentra en app.asar.unpacked
      if (scriptPath.includes('app.asar')) {
        scriptPath = scriptPath.replace('app.asar', 'app.asar.unpacked');
      }

      try {
        if (usesInterpreter) {
          const targetScript = args?.[args.length - 1];
          if (!targetScript || !fs.existsSync(targetScript)) {
            resolve({ success: false, error: `No se encontro printer.py en: ${targetScript || '(sin ruta)'}` });
            return;
          }
        } else if (!fs.existsSync(scriptPath)) {
          resolve({ success: false, error: `No se encontro el ejecutable/cliente de impresiÃ³n en: ${scriptPath}` });
          return;
        }

        // Ejecutar el proceso binario compilado o script python
        const pythonProcess = spawn(scriptPath, args, { shell: false });

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

