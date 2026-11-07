import { randomBytes } from 'node:crypto';

/**
 * Builds argv + env for `rclone rcd`. Credentials go ONLY into env (RCLONE_RC_USER/PASS):
 * argv is readable by other local users via `ps` / `/proc/<pid>/cmdline`.
 */
export interface RcdLaunch {
  args: string[];
  env: NodeJS.ProcessEnv;
}

export interface RcdOptions {
  port: number;
  configPath: string;
  cacheDir: string;
  user: string;
  pass: string;
  baseEnv: NodeJS.ProcessEnv;
}

export const generateRcCredentials = (): { user: string; pass: string } => ({
  user: 'sv-' + randomBytes(8).toString('hex'),
  pass: randomBytes(32).toString('base64url'),
});

/** Strip anything that could change rclone's behaviour behind our back or leak secrets. */
export const sanitizeEnv = (env: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
  const out: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('RCLONE_') || key.startsWith('SYNCVAULT_')) continue;
    if (key === 'ELECTRON_RUN_AS_NODE') continue;
    out[key] = value;
  }
  return out;
};

export const buildRcdLaunch = (opts: RcdOptions): RcdLaunch => ({
  args: [
    'rcd',
    `--rc-addr=127.0.0.1:${opts.port}`,
    // Always Syncvault's own config — never the user's ~/.config/rclone/rclone.conf.
    `--config=${opts.configPath}`,
    `--cache-dir=${opts.cacheDir}`,
    '--ask-password=false',
    '--log-level=NOTICE',
    // TODO(security): encrypted rclone.conf — supply RCLONE_CONFIG_PASS (from the vault)
    // or --password-command here. Never write the config password to disk.
  ],
  env: {
    ...sanitizeEnv(opts.baseEnv),
    RCLONE_RC_USER: opts.user,
    RCLONE_RC_PASS: opts.pass,
  },
});
