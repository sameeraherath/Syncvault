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
export const RENDERER_ALLOWED_METHODS = ['status.get'] as const satisfies readonly RpcMethodName[];
export type RendererMethodName = (typeof RENDERER_ALLOWED_METHODS)[number];

export const isRendererMethod = (name: string): name is RendererMethodName =>
  (RENDERER_ALLOWED_METHODS as readonly string[]).includes(name);
