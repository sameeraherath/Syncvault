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
  /** rclone config encryption password, derived from the vault. Env only. */
  configPass: string;
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
  ],
  env: {
    ...sanitizeEnv(opts.baseEnv),
    RCLONE_RC_USER: opts.user,
    RCLONE_RC_PASS: opts.pass,
    // Decrypts (and re-encrypts on save) Syncvault's rclone.conf. Never argv, never disk.
    RCLONE_CONFIG_PASS: opts.configPass,
  },
});

/** Child-only env var the password helper prints. Stripped from every other child by sanitizeEnv. */
export const PASSWORD_HELPER_ENV = 'SYNCVAULT_RCLONE_NEW_PASS';

export interface EncryptConfigOptions {
  configPath: string;
  configPass: string;
  /** Electron binary (process.execPath in the core). */
  nodeBinary: string;
  /** dist/password-helper.mjs — prints PASSWORD_HELPER_ENV to stdout. */
  helperScript: string;
  baseEnv: NodeJS.ProcessEnv;
}

/**
 * `rclone config encryption set` for an empty config. rclone gets the new password from
 * --password-command, which runs our helper; the password itself only travels in the env.
 */
export const buildEncryptConfigLaunch = (opts: EncryptConfigOptions): RcdLaunch => ({
  args: [
    `--config=${opts.configPath}`,
    '--ask-password=false',
    `--password-command=${quoteArg(opts.nodeBinary)} ${quoteArg(opts.helperScript)}`,
    'config',
    'encryption',
    'set',
  ],
  env: {
    ...sanitizeEnv(opts.baseEnv),
    ELECTRON_RUN_AS_NODE: '1',
    [PASSWORD_HELPER_ENV]: opts.configPass,
  },
});

/** rclone splits --password-command like a CSV row: wrap in quotes, double any quote inside. */
const quoteArg = (s: string): string => `"${s.replace(/"/g, '""')}"`;

export const ENCRYPTED_CONFIG_HEADER = '# Encrypted rclone configuration File';
