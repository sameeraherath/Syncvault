import { z } from 'zod';
import { CoreEnv } from '@syncvault/shared';

const coreEnvSchema = z.object({
  [CoreEnv.RpcPath]: z.string().min(1),
  [CoreEnv.RpcToken]: z.string().min(32),
  [CoreEnv.AppDataDir]: z.string().min(1),
  [CoreEnv.RcloneBinary]: z.string().min(1),
  [CoreEnv.AppVersion]: z.string().min(1),
  [CoreEnv.LogLevel]: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export interface CoreConfig {
  rpcPath: string;
  rpcToken: string;
  appDataDir: string;
  rcloneBinary: string;
  appVersion: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Reads and validates the configuration main passes via environment variables, then
 * removes the auth token from process.env so it is never inherited by rclone.
 */
export const readCoreConfig = (env: NodeJS.ProcessEnv = process.env): CoreConfig => {
  const parsed = coreEnvSchema.safeParse(env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid core environment: ${missing}`);
  }
  const e = parsed.data;
  delete env[CoreEnv.RpcToken];
  return {
    rpcPath: e[CoreEnv.RpcPath],
    rpcToken: e[CoreEnv.RpcToken],
    appDataDir: e[CoreEnv.AppDataDir],
    rcloneBinary: e[CoreEnv.RcloneBinary],
    appVersion: e[CoreEnv.AppVersion],
    logLevel: e[CoreEnv.LogLevel],
  };
};
