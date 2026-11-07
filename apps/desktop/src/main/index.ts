import { app, type BrowserWindow, type Tray } from 'electron';
import { IpcChannel } from '@syncvault/shared';
import { CoreSupervisor } from './core/supervisor.js';
import { registerIpc } from './ipc.js';
import { errorMessage, log } from './log.js';
import { resolveResourcePaths } from './paths.js';
import { installSecurityHandlers } from './security.js';
import { createTray } from './tray.js';
import { detectTraySupport } from './tray-support.js';
import { createMainWindow } from './window.js';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let supervisor: CoreSupervisor | null = null;
let quitting = false;
let cleanedUp = false;

const showWindow = (): void => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
};

const bootstrap = async (): Promise<void> => {
  installSecurityHandlers();
  const trayAvailable = await detectTraySupport();
  if (!trayAvailable) {
    // TODO(tray): offer in-app guidance to install the GNOME AppIndicator extension.
    log.warn(
      'system tray not available (GNOME without AppIndicator?); window will minimise on close',
    );
  }

  const paths = resolveResourcePaths();
  supervisor = new CoreSupervisor({
    coreScript: paths.coreScript,
    rcloneBinary: paths.rcloneBinary,
    appDataDir: app.getPath('userData'),
    appVersion: app.getVersion(),
  });
  registerIpc(supervisor, trayAvailable);

  mainWindow = createMainWindow({ shouldKeepRunning: () => !quitting, trayAvailable });
  supervisor.onState((state) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannel.CoreState, state);
    }
  });

  if (trayAvailable) {
    tray = createTray(paths.trayIcon, { onOpen: showWindow, onQuit: () => app.quit() });
  }

  await supervisor.start();
};

// Single instance: a second launch only focuses the existing window. Two instances must
// never run two cores syncing the same folders.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.on('activate', showWindow);

  app.on('before-quit', (event) => {
    quitting = true;
    if (cleanedUp) return;
    event.preventDefault();
    void (async () => {
      try {
        await supervisor?.stop();
      } catch (e) {
        log.error(`error stopping core: ${errorMessage(e)}`);
      }
      tray?.destroy();
      tray = null;
      cleanedUp = true;
      app.quit();
    })();
  });

  // Windows are hidden, not closed, while running; this only fires during quit.
  app.on('window-all-closed', () => {
    if (quitting) app.quit();
  });

  app.whenReady().then(bootstrap, (e: unknown) => {
    log.error(`startup failed: ${errorMessage(e)}`);
    app.exit(1);
  });
}
