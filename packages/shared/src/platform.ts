/**
 * Platform key used for bundled binaries: `resources/rclone/<platform>-<arch>/`.
 * Uses Node's `process.platform` / `process.arch` names so electron-builder's
 * `${platform}-${arch}` macros map to the same folders.
 */
export type PlatformKey = 'linux-x64' | 'linux-arm64' | 'win32-x64' | 'darwin-x64' | 'darwin-arm64';

export const SUPPORTED_PLATFORM_KEYS: readonly PlatformKey[] = [
  'linux-x64',
  'linux-arm64',
  'win32-x64',
  'darwin-x64',
  'darwin-arm64',
];

export const platformKey = (platform: string, arch: string): PlatformKey | null => {
  const key = `${platform}-${arch}`;
  return (SUPPORTED_PLATFORM_KEYS as readonly string[]).includes(key) ? (key as PlatformKey) : null;
};

export const rcloneExecutableName = (platform: string): string =>
  platform === 'win32' ? 'rclone.exe' : 'rclone';
