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
  'history.list': {
    params: z
      .object({ limit: z.number().int().min(1).max(HISTORY_MAX_LIMIT).optional() })
      .strict()
      .optional(),
    result: z.object({ entries: z.array(historyEntrySchema) }),
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
] as const satisfies readonly RpcMethodName[];
export type RendererMethodName = (typeof RENDERER_ALLOWED_METHODS)[number];

export const isRendererMethod = (name: string): name is RendererMethodName =>
  (RENDERER_ALLOWED_METHODS as readonly string[]).includes(name);
