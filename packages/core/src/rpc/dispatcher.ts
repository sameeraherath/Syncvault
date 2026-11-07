import { createHash, timingSafeEqual } from 'node:crypto';
import {
  JSONRPC_VERSION,
  RpcErrorCode,
  isRpcMethodName,
  rpcMethods,
  rpcRequestSchema,
  type RpcId,
  type RpcMethodName,
  type RpcResponse,
  type RpcResult,
} from '@syncvault/shared';
import { errorMessage, type Logger } from '../log.js';

/** Handlers for every method except auth.hello (handled by the dispatcher itself). */
export type RpcHandlers = {
  [M in Exclude<RpcMethodName, 'auth.hello'>]: (
    params: unknown,
  ) => Promise<RpcResult<M>> | RpcResult<M>;
};

export interface ConnectionState {
  authenticated: boolean;
}

export interface DispatchOutcome {
  response: RpcResponse | null;
  /** True when the connection must be closed after sending the response. */
  close: boolean;
}

const failure = (id: RpcId | null, code: number, message: string): RpcResponse => ({
  jsonrpc: JSONRPC_VERSION,
  id,
  error: { code, message },
});

const digest = (value: string): Buffer => createHash('sha256').update(value, 'utf8').digest();

/** Constant-time token comparison (hash first so lengths always match). */
export const tokensEqual = (presented: string, expected: string): boolean =>
  timingSafeEqual(digest(presented), digest(expected));

/**
 * Handles one framed JSON-RPC message. Pure with respect to I/O so it can be unit-tested
 * without sockets. The first valid request on a connection must be `auth.hello`.
 */
export const dispatchMessage = async (
  raw: string,
  state: ConnectionState,
  token: string,
  handlers: RpcHandlers,
  logger: Logger,
): Promise<DispatchOutcome> => {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { response: failure(null, RpcErrorCode.ParseError, 'Parse error'), close: true };
  }

  const req = rpcRequestSchema.safeParse(json);
  if (!req.success) {
    return {
      response: failure(null, RpcErrorCode.InvalidRequest, 'Invalid request'),
      close: !state.authenticated,
    };
  }
  const { id, method, params } = req.data;

  if (!state.authenticated) {
    if (method !== 'auth.hello') {
      return { response: failure(id, RpcErrorCode.Unauthorized, 'Unauthorized'), close: true };
    }
    const p = rpcMethods['auth.hello'].params.safeParse(params);
    if (!p.success || !tokensEqual(p.data.token, token)) {
      logger.warn('rejected RPC connection with invalid token');
      return { response: failure(id, RpcErrorCode.Unauthorized, 'Unauthorized'), close: true };
    }
    state.authenticated = true;
    return { response: { jsonrpc: JSONRPC_VERSION, id, result: { ok: true } }, close: false };
  }

  if (!isRpcMethodName(method) || method === 'auth.hello') {
    return {
      response: failure(id, RpcErrorCode.MethodNotFound, 'Method not found'),
      close: false,
    };
  }

  const schema = rpcMethods[method].params;
  const p = schema.safeParse(params);
  if (!p.success) {
    return { response: failure(id, RpcErrorCode.InvalidParams, 'Invalid params'), close: false };
  }

  try {
    const handler = handlers[method] as (params: unknown) => Promise<unknown> | unknown;
    const result = await handler(p.data);
    return { response: { jsonrpc: JSONRPC_VERSION, id, result }, close: false };
  } catch (e) {
    logger.error('RPC handler failed', { method, error: errorMessage(e) });
    return { response: failure(id, RpcErrorCode.InternalError, 'Internal error'), close: false };
  }
};
