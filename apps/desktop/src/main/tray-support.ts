import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const gnomeExtensionsShowTray = (enabledList: string): boolean =>
  /appindicator/i.test(enabledList);

/**
 * Best-effort check whether a tray icon will be visible.
 * Stock GNOME hides tray icons unless the AppIndicator extension is enabled.
 * TODO(tray): also detect at runtime via the StatusNotifierWatcher D-Bus name.
 */
export const detectTraySupport = async (
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean> => {
  if (platform !== 'linux') return true;
  const desktop = (env.XDG_CURRENT_DESKTOP ?? '').toLowerCase();
  if (!desktop.includes('gnome')) return true;
  try {
    const { stdout } = await execFileAsync('gnome-extensions', ['list', '--enabled'], {
      timeout: 3000,
    });
    return gnomeExtensionsShowTray(stdout);
  } catch {
    return false;
  }
};
