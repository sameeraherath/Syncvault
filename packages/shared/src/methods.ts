import { z } from 'zod';

/**
 * Every RPC method the core understands, with zod schemas for params and result.
 * Both sides validate: Electron main validates before forwarding, the core validates
 * again on receipt (defence in depth), and main validates results coming back.
 */

const emptyParams = z.object({}).strict().optional();

export const rcloneStatusSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('starting') }),
  z.object({ state: z.literal('running'), version: z.string() }),
  z.object({ state: z.literal('missing'), message: z.string() }),
  z.object({ state: z.literal('error'), message: z.string() }),
  z.object({ state: z.literal('stopped') }),
]);
export type RcloneStatus = z.infer<typeof rcloneStatusSchema>;

export const databaseStatusSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('ready'), schemaVersion: z.number().int() }),
  z.object({ state: z.literal('error'), message: z.string() }),
]);
export type DatabaseStatus = z.infer<typeof databaseStatusSchema>;

export const statusGetResultSchema = z.object({
  appVersion: z.string(),
  coreVersion: z.string(),
  platform: z.string(),
  arch: z.string(),
  rclone: rcloneStatusSchema,
  database: databaseStatusSchema,
});
export type StatusGetResult = z.infer<typeof statusGetResultSchema>;

/**
 * Activity history. Starter vocabulary — every event needs a label in the renderer's locales
 * (`pages.activity.events.<event>`); the TranslationKey type turns a missing one into a type error.
 */
export const historyEventSchema = z.enum([
  'sync.completed',
  'sync.failed',
  'sync.paused',
  'account.added',
  'folder.added',
]);
export type HistoryEvent = z.infer<typeof historyEventSchema>;

/**
 * One activity entry. Privacy: only the folder *name* (never the full local path) and no free-text
 * detail, which may later contain paths or error text.
 */
export const historyEntrySchema = z.object({
  id: z.number().int().positive(),
  event: historyEventSchema,
  folderName: z.string().nullable(),
  /** Unix epoch milliseconds. */
  createdAt: z.number().int().nonnegative(),
});
export type HistoryEntry = z.infer<typeof historyEntrySchema>;

export const HISTORY_DEFAULT_LIMIT = 50;
export const HISTORY_MAX_LIMIT = 200;

/** Cloud providers in the MVP, as rclone backend names. */
export const providerSchema = z.enum(['drive', 'onedrive']);
export type Provider = z.infer<typeof providerSchema>;

/** A linked cloud account as the renderer sees it. The internal rclone remote name is never exposed. */
export const accountSchema = z.object({
  id: z.string().min(1).max(64),
  provider: providerSchema,
  displayName: z.string(),
});
export type Account = z.infer<typeof accountSchema>;

export const REMOTE_PATH_MAX_LENGTH = 1024;
export const FILES_MAX_ENTRIES = 2000;

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f]/;

/**
 * A path inside a cloud account: relative, `/`-separated on every OS, `''` = the account root.
 * Rejects `..`/`.` segments, leading or trailing `/`, `\\`, empty segments and control characters,
 * so a renderer can never point rclone outside the account.
 */
export const isSafeRemotePath = (p: string): boolean => {
  if (p === '') return true;
  if (p.length > REMOTE_PATH_MAX_LENGTH) return false;
  if (p.includes('\\') || CONTROL_CHARS_RE.test(p)) return false;
  return p.split('/').every((s) => s !== '' && s !== '.' && s !== '..');
};

export const remotePathSchema = z
  .string()
  .max(REMOTE_PATH_MAX_LENGTH)
  .refine(isSafeRemotePath, { message: 'Invalid path' });

export const fileEntrySchema = z.object({
  name: z.string().min(1),
  isDir: z.boolean(),
  /** Bytes; null for folders or when the provider doesn't report it. */
  size: z.number().int().nonnegative().nullable(),
  /** Unix epoch milliseconds, or null if unknown. */
  modTime: z.number().int().nullable(),
  /** Set when this folder is a Syncvault sync folder. */
  syncFolder: z.object({ encrypted: z.boolean() }).nullable(),
});
export type FileEntry = z.infer<typeof fileEntrySchema>;

/**
 * `encrypted`: the path is inside an encrypted sync folder, whose names are ciphertext until the vault
 * is unlocked. Error reasons are codes, never raw rclone messages (they can contain paths).
 */
export const fileListResultSchema = z.discriminatedUnion('state', [
  z.object({
    state: z.literal('ok'),
    entries: z.array(fileEntrySchema).max(FILES_MAX_ENTRIES),
    truncated: z.boolean(),
  }),
  z.object({ state: z.literal('encrypted') }),
  z.object({
    state: z.literal('error'),
    reason: z.enum(['accountNotFound', 'rcloneUnavailable', 'listFailed']),
  }),
]);
export type FileListResult = z.infer<typeof fileListResultSchema>;

/** Master password rules, shared by the onboarding UI and the core. Counted in code points. */
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 1024;

/** A new master password. Unlock accepts any non-empty password so old vaults keep working if rules change. */
export const newPasswordSchema = z
  .string()
  .max(MAX_PASSWORD_LENGTH * 2)
  .refine((p) => [...p].length >= MIN_PASSWORD_LENGTH && [...p].length <= MAX_PASSWORD_LENGTH, {
    message: 'Invalid password length',
  });
const anyPasswordSchema = z
  .string()
  .min(1)
  .max(MAX_PASSWORD_LENGTH * 2);

export const vaultStateSchema = z.enum(['none', 'locked', 'unlocked']);
export type VaultState = z.infer<typeof vaultStateSchema>;

const okTrue = z.object({ ok: z.literal(true) });
const failWith = <const T extends readonly [string, ...string[]]>(reasons: T) =>
  z.object({ ok: z.literal(false), reason: z.enum(reasons) });

export const rpcMethods = {
  /** Must be the first message on every connection. */
  'auth.hello': {
    params: z.object({ token: z.string().min(32).max(256) }).strict(),
    result: z.object({ ok: z.literal(true) }),
  },
  'status.get': {
    params: emptyParams,
    result: statusGetResultSchema,
  },
  /** Newest activity entries first. */
  /** Linked cloud accounts, by display name. */
  'accounts.list': {
    params: emptyParams,
    result: z.object({ accounts: z.array(accountSchema) }),
  },
  /** Read-only folder listing inside a linked account. The core resolves the rclone remote. */
  'files.list': {
    params: z.object({ accountId: z.string().min(1).max(64), path: remotePathSchema }).strict(),
    result: fileListResultSchema,
  },
  'history.list': {
    params: z
      .object({ limit: z.number().int().min(1).max(HISTORY_MAX_LIMIT).optional() })
      .strict()
      .optional(),
    result: z.object({ entries: z.array(historyEntrySchema) }),
  },
  /** Whether a vault exists and whether it is unlocked. */
  'vault.status': {
    params: emptyParams,
    result: z.object({ state: vaultStateSchema }),
  },
  /** First run. Never replaces an existing vault. Leaves the vault unlocked. */
  'vault.create': {
    params: z.object({ password: newPasswordSchema }).strict(),
    result: z.union([
      z.object({ ok: z.literal(true), recoveryKey: z.string().min(1).max(64) }),
      failWith(['exists']),
    ]),
  },
  'vault.unlock': {
    params: z.object({ password: anyPasswordSchema }).strict(),
    result: z.union([okTrue, failWith(['wrongPassword', 'noVault', 'corrupt'])]),
  },
  /** Forgotten password: unlock with the recovery key and set a new master password. */
  'vault.recover': {
    params: z
      .object({ recoveryKey: z.string().min(1).max(128), newPassword: newPasswordSchema })
      .strict(),
    result: z.union([okTrue, failWith(['invalidKey', 'wrongKey', 'corrupt'])]),
  },
  /** Forgets the key from memory and stops rclone. */
  'vault.lock': {
    params: emptyParams,
    result: okTrue,
  },
  /** Graceful shutdown: core stops rclone, closes the DB and exits. */
  'core.shutdown': {
    params: emptyParams,
    result: z.object({ ok: z.literal(true) }),
  },
} as const;

export type RpcMethodName = keyof typeof rpcMethods;
export type RpcParams<M extends RpcMethodName> = z.input<(typeof rpcMethods)[M]['params']>;
export type RpcResult<M extends RpcMethodName> = z.output<(typeof rpcMethods)[M]['result']>;

export const isRpcMethodName = (name: string): name is RpcMethodName =>
  Object.prototype.hasOwnProperty.call(rpcMethods, name);

/** Methods the renderer may call (through preload → main). Never include auth / shutdown. */
export const RENDERER_ALLOWED_METHODS = [
  'status.get',
  'history.list',
  'accounts.list',
  'files.list',
  'vault.status',
  'vault.create',
  'vault.unlock',
  'vault.recover',
  'vault.lock',
] as const satisfies readonly RpcMethodName[];
export type RendererMethodName = (typeof RENDERER_ALLOWED_METHODS)[number];

export const isRendererMethod = (name: string): name is RendererMethodName =>
  (RENDERER_ALLOWED_METHODS as readonly string[]).includes(name);
