import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { registerProductHandlers } from './ipc/products.js';
import { registerSalesHandlers } from './ipc/sales.js';
import { registerInventoryHandlers } from './ipc/inventory.js';
import { registerCustomerHandlers } from './ipc/customers.js';
import { registerSettingsHandlers } from './ipc/settings.js';
import { registerAuthHandlers } from './ipc/auth.js';
import { closeDatabase } from './db/index.js';
import { registerReceiptHandlers } from './services/receipt.js';

let mainWindow: BrowserWindow | null = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow(): void {
  const iconPath = app.isPackaged
    ? path.join(__dirname, '../renderer/icon.ico')
    : path.join(__dirname, '../public/icon.ico');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'POS System',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    icon: iconPath,
    show: false,
  });

  mainWindow.setMenu(null);

  if (process.env.NODE_ENV === 'development' && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  registerProductHandlers();
  registerSalesHandlers();
  registerInventoryHandlers();
  registerCustomerHandlers();
  registerSettingsHandlers();
  registerAuthHandlers();
  registerReceiptHandlers();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  closeDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  closeDatabase();
});
