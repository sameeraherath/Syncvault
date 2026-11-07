import {
  RpcErrorCode,
  err,
  isRendererMethod,
  ok,
  rpcMethods,
  type RendererMethodName,
  type Result,
  type RpcErrorObject,
} from '@syncvault/shared';

const ALLOWED_EXTERNAL_HOSTS = new Set(['getsyncvault.com', 'www.getsyncvault.com', 'github.com']);

/** Validates a renderer → core request before main forwards it. */
export const validateRendererRpc = (
  method: unknown,
  params: unknown,
): Result<{ method: RendererMethodName; params: unknown }, RpcErrorObject> => {
  if (typeof method !== 'string' || !isRendererMethod(method)) {
    return err({ code: RpcErrorCode.MethodNotFound, message: 'Method not allowed' });
  }
  const parsed = rpcMethods[method].params.safeParse(params);
  if (!parsed.success) {
    return err({ code: RpcErrorCode.InvalidParams, message: 'Invalid params' });
  }
  return ok({ method, params: parsed.data });
};

/** Only https links to an allow-list of hosts may be opened in the system browser. */
export const isAllowedExternalUrl = (raw: unknown): raw is string => {
  if (typeof raw !== 'string' || raw.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  return (
    url.protocol === 'https:' &&
    url.username === '' &&
    url.password === '' &&
    url.port === '' &&
    ALLOWED_EXTERNAL_HOSTS.has(url.hostname)
  );
};
