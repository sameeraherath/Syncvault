import path from 'node:path';

/**
 * Where the core's JSON-RPC endpoint lives.
 * - Linux: $XDG_RUNTIME_DIR/syncvault/core.sock (fallback: <appData>/run/core.sock)
 * - macOS: <appData>/run/core.sock
 * - Windows: named pipe with a random name
 * Directory is created 0700 and the socket chmod 0600 by the core.
 */
export const coreSocketPath = (opts: {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  appDataDir: string;
  randomHex: string;
}): string => {
  if (opts.platform === 'win32') return `\\\\.\\pipe\\syncvault-${opts.randomHex}`;
  // Use POSIX path semantics for Unix targets regardless of the host (keeps tests portable).
  const p = path.posix;
  const runtimeDir = opts.env.XDG_RUNTIME_DIR;
  if (opts.platform === 'linux' && runtimeDir && p.isAbsolute(runtimeDir)) {
    return p.join(runtimeDir, 'syncvault', 'core.sock');
  }
  // TODO(macos): check the 104-byte sun_path limit for long home directories.
  return p.join(opts.appDataDir, 'run', 'core.sock');
};
