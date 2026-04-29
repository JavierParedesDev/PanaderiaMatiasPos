const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');

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

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('print-ticket', async (event, ticketData = {}) => {
    return new Promise((resolve) => {
      // Ruta al script de Python
      const scriptPath = path.join(__dirname, 'scripts/printer.py');

      // Ejecutar el proceso de Python
      const pythonProcess = spawn('python', [scriptPath]);

      let outputData = '';
      let errorData = '';

      pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.error(`Python process exited with code ${code}. Error: ${errorData}`);
          resolve({ success: false, error: errorData || `Error de ejecución (código ${code})` });
          return;
        }

        try {
          const result = JSON.parse(outputData);
          resolve(result);
        } catch (e) {
          console.error('Error parsing Python output:', outputData);
          resolve({ success: false, error: 'Error al procesar la respuesta de la impresora.' });
        }
      });

      // Enviar datos vía stdin en formato JSON
      pythonProcess.stdin.write(JSON.stringify({
        ...ticketData,
        fecha: new Date().toLocaleString('es-CL') // Asegurar fecha local si no viene
      }));
      pythonProcess.stdin.end();
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
