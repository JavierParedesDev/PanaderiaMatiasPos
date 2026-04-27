const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

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
    let printWindow = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });

    const items = Array.isArray(ticketData.items) ? ticketData.items : [];
    const total = Number(ticketData.total || 0);

    const html = `
      <html>
        <body style="font-family: 'Courier New', Courier, monospace; width: 80mm; margin: 0; padding: 10px; font-size: 12px;">
          <div style="text-align: center;">
            <h2 style="margin: 0;">PANADERIA MATÍAS</h2>
            <p style="margin: 5px 0;">Folio: ${escapeHtml(ticketData.folio)}</p>
            <p style="margin: 5px 0;">Fecha: ${new Date().toLocaleString()}</p>
          </div>
          <hr style="border: 0; border-top: 1px dashed black;">
          <table style="width: 100%; border-collapse: collapse;">
            ${items.map(item => `
              <tr>
                <td>${Number(item.cantidad || 0)} x ${escapeHtml(String(item.nombre || '').substring(0, 20))}</td>
                <td style="text-align: right;">$${(Number(item.cantidad || 0) * Number(item.precio_unitario || 0)).toLocaleString()}</td>
              </tr>
            `).join('')}
          </table>
          <hr style="border: 0; border-top: 1px dashed black;">
          <div style="text-align: right; font-weight: bold; font-size: 16px;">
            TOTAL: $${total.toLocaleString()}
          </div>
          <div style="margin-top: 10px; text-align: center; font-size: 10px;">
            METODO: ${escapeHtml(ticketData.metodo)}
          </div>
          <div style="margin-top: 20px; text-align: center;">
            ¡Gracias por su compra!
          </div>
        </body>
      </html>
    `;

    printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    return new Promise((resolve) => {
      printWindow.webContents.on('did-finish-load', () => {
        printWindow.webContents.print({ silent: true, printBackground: true }, (success, failureReason) => {
          printWindow.close();
          resolve({ success, failureReason });
        });
      });
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
