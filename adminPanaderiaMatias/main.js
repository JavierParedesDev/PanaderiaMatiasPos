const path = require('path');
const net = require('net');
const fs = require('fs');
const { app, BrowserWindow, ipcMain } = require('electron');

const DEFAULT_SCALE_TIMEOUT_MS = 8000;
const appIconPath = path.join(__dirname, 'assets', 'icon.ico');

function toPayloadBuffer(payload) {
  if (typeof payload === 'string') {
    return Buffer.from(payload, 'utf8');
  }

  if (Buffer.isBuffer(payload)) {
    return payload;
  }

  if (ArrayBuffer.isView(payload)) {
    return Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength);
  }

  if (payload instanceof ArrayBuffer) {
    return Buffer.from(payload);
  }

  if (payload?.type === 'Buffer' && Array.isArray(payload.data)) {
    return Buffer.from(payload.data);
  }

  if (Array.isArray(payload)) {
    return Buffer.from(payload);
  }

  return Buffer.from(payload);
}

function sendScalePayload({ host, port, payload, timeoutMs = DEFAULT_SCALE_TIMEOUT_MS }) {
  return new Promise((resolve, reject) => {
    const targetHost = String(host || '').trim();
    const targetPort = Number(port);

    if (!targetHost) {
      reject(new Error('Debes indicar la IP de la balanza.'));
      return;
    }

    if (!Number.isInteger(targetPort) || targetPort <= 0 || targetPort > 65535) {
      reject(new Error('Debes indicar un puerto valido para la balanza.'));
      return;
    }

    if (!payload) {
      reject(new Error('No hay datos PLU para enviar.'));
      return;
    }

    const payloadBuffer = toPayloadBuffer(payload);

    let settled = false;
    let responseBuffer = Buffer.alloc(0);
    const socket = new net.Socket();

    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      socket.destroy();

      if (error) {
        reject(error);
        return;
      }

      resolve(result);
    };

    socket.setTimeout(Number(timeoutMs) || DEFAULT_SCALE_TIMEOUT_MS);

    socket.once('connect', () => {
      socket.write(payloadBuffer, () => {
        setTimeout(() => {
          socket.end();
        }, 250);
      });
    });

    socket.on('data', (chunk) => {
      responseBuffer = Buffer.concat([responseBuffer, chunk]);
    });

    socket.once('timeout', () => {
      finish(new Error(`Tiempo de espera agotado conectando a ${targetHost}:${targetPort}.`));
    });

    socket.once('error', (error) => {
      finish(new Error(`No se pudo conectar con la balanza: ${error.message}`));
    });

    socket.once('close', (hadError) => {
      if (hadError) return;

      finish(null, {
        success: true,
        host: targetHost,
        port: targetPort,
        bytesSent: payloadBuffer.length,
        response: responseBuffer.toString('utf8'),
        responseHex: responseBuffer.toString('hex').toUpperCase().match(/.{1,2}/g)?.join(' ') || ''
      });
    });

    socket.connect(targetPort, targetHost);
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#f3efe6',
    icon: appIconPath,
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

try {
  const configPath = path.join(__dirname, 'admin.yml');
  if (fs.existsSync(configPath)) {
    fs.copyFileSync(configPath, path.join(__dirname, 'dev-app-update.yml'));
    fs.copyFileSync(configPath, path.join(__dirname, 'app-update.yml'));
  }
} catch (e) {
  console.error("Error configurando archivos de actualizacion:", e);
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.panaderiamatias.admin');

const { autoUpdater } = require('electron-updater');

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

ipcMain.handle('scale:send-plu', async (_event, payload) => sendScalePayload(payload));

  createWindow();

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
