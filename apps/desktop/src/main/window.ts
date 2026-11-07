import path from 'node:path';
import { app, BrowserWindow } from 'electron';
import { devServerUrl } from './security.js';

export interface MainWindowOptions {
  /** Called on close; return true to hide/minimise instead of closing. */
  shouldKeepRunning: () => boolean;
  trayAvailable: boolean;
}

export const createMainWindow = (opts: MainWindowOptions): BrowserWindow => {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 560,
    show: false,
    title: 'Syncvault',
    backgroundColor: '#F6F7F9',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  });

  win.once('ready-to-show', () => win.show());

  // Closing the window keeps the core running in the tray. Without a tray (GNOME without
  // AppIndicator) we minimise instead, so the user can always get back to the app.
  win.on('close', (event) => {
    if (!opts.shouldKeepRunning()) return;
    event.preventDefault();
    if (opts.trayAvailable) win.hide();
    else win.minimize();
  });

  const dev = devServerUrl();
  if (dev) void win.loadURL(dev);
  else void win.loadFile(path.join(__dirname, '../renderer/index.html'));

  return win;
};
