import { z } from 'zod';

/** JSON-RPC 2.0 envelope schemas. Transport: newline-delimited JSON over a local socket. */

export const JSONRPC_VERSION = '2.0' as const;

/** Maximum size of one framed message (bytes). Larger messages close the connection. */
export const RPC_MAX_MESSAGE_BYTES = 1024 * 1024;

export const RpcErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  /** Connection has not presented a valid auth token. */
  Unauthorized: -32001,
  /** Core service is not running / not reachable (used by Electron main). */
  CoreUnavailable: -32002,
  /** Request timed out. */
  Timeout: -32003,
} as const;

export const rpcIdSchema = z.union([z.string().min(1).max(64), z.number().int().nonnegative()]);
export type RpcId = z.infer<typeof rpcIdSchema>;

export const rpcRequestSchema = z
  .object({
    jsonrpc: z.literal(JSONRPC_VERSION),
    id: rpcIdSchema,
    method: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/),
    params: z.unknown().optional(),
  })
  .strict();
export type RpcRequest = z.infer<typeof rpcRequestSchema>;

export const rpcErrorObjectSchema = z.object({
  code: z.number().int(),
  message: z.string(),
  data: z.unknown().optional(),
});
export type RpcErrorObject = z.infer<typeof rpcErrorObjectSchema>;

export const rpcSuccessSchema = z.object({
  jsonrpc: z.literal(JSONRPC_VERSION),
  id: rpcIdSchema,
  result: z.unknown(),
});

export const rpcFailureSchema = z.object({
  jsonrpc: z.literal(JSONRPC_VERSION),
  id: rpcIdSchema.nullable(),
  error: rpcErrorObjectSchema,
});

export const rpcResponseSchema = z.union([rpcSuccessSchema, rpcFailureSchema]);
export type RpcResponse = z.infer<typeof rpcResponseSchema>;
