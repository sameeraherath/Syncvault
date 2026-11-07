import { app, session, shell } from 'electron';
import { isAllowedExternalUrl } from './validate.js';
import { log } from './log.js';

/** Dev server URL (only in development). Never load any other remote URL. */
export const devServerUrl = (): string | null => {
  const url = process.env.ELECTRON_RENDERER_URL;
  if (app.isPackaged || !url) return null;
  try {
    const u = new URL(url);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1' ? url : null;
  } catch {
    return null;
  }
};

/** True if `url` is the app's own renderer (dev server or bundled file). */
export const isAppUrl = (url: string): boolean => {
  try {
    const u = new URL(url);
    const dev = devServerUrl();
    if (dev) return u.origin === new URL(dev).origin;
    return u.protocol === 'file:' && u.pathname.endsWith('/renderer/index.html');
  } catch {
    return false;
  }
};

export const openExternalSafely = (url: unknown): boolean => {
  if (!isAllowedExternalUrl(url)) {
    log.warn('blocked external URL');
    return false;
  }
  void shell.openExternal(url);
  return true;
};

/** App-wide hardening for every webContents. Call once, before creating windows. */
export const installSecurityHandlers = (): void => {
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) =>
    callback(false),
  );
  session.defaultSession.setPermissionCheckHandler(() => false);

  app.on('web-contents-created', (_event, contents) => {
    // No in-app navigation: the UI is a single page.
    contents.on('will-navigate', (event, url) => {
      event.preventDefault();
      openExternalSafely(url);
    });
    contents.on('will-redirect', (event) => event.preventDefault());
    contents.on('will-attach-webview', (event) => event.preventDefault());
    contents.setWindowOpenHandler(({ url }) => {
      openExternalSafely(url);
      return { action: 'deny' };
    });
  });
};
