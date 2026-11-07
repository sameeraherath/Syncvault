import path from 'node:path';
import { app } from 'electron';
import { platformKey, rcloneExecutableName } from '@syncvault/shared';

/**
 * The ONLY place that resolves bundled resource paths.
 * Development: repo paths. Packaged: process.resourcesPath (electron-builder extraResources).
 */
export interface ResourcePaths {
  coreScript: string;
  rcloneBinary: string;
  trayIcon: string;
}

export const resolveResourcePaths = (): ResourcePaths => {
  const exe = rcloneExecutableName(process.platform);
  if (app.isPackaged) {
    const res = process.resourcesPath;
    return {
      coreScript: path.join(res, 'core', 'core.mjs'),
      rcloneBinary: path.join(res, 'rclone', exe),
      trayIcon: path.join(res, 'tray.png'),
    };
  }
  const appRoot = app.getAppPath(); // apps/desktop
  const repoRoot = path.resolve(appRoot, '..', '..');
  const key = platformKey(process.platform, process.arch) ?? `${process.platform}-${process.arch}`;
  return {
    coreScript: path.join(repoRoot, 'packages', 'core', 'dist', 'core.mjs'),
    rcloneBinary: path.join(repoRoot, 'resources', 'rclone', key, exe),
    trayIcon: path.join(appRoot, 'resources', 'tray.png'),
  };
};
