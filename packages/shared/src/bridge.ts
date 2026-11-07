import type { RpcErrorObject } from './rpc.js';
import type { RendererMethodName, RpcParams, RpcResult } from './methods.js';
import type { CoreState } from './core-state.js';
import type { Result } from './result.js';

/** Shape of `window.syncvault`, exposed by the preload script via contextBridge. */
export interface SyncvaultBridge {
  rpc<M extends RendererMethodName>(
    method: M,
    params?: RpcParams<M>,
  ): Promise<Result<RpcResult<M>, RpcErrorObject>>;
  getCoreState(): Promise<CoreState>;
  /** Subscribe to core state changes. Returns an unsubscribe function. */
  onCoreState(listener: (state: CoreState) => void): () => void;
  /** Whether a system tray is likely available (GNOME without AppIndicator → false). */
  isTrayAvailable(): Promise<boolean>;
  /** Opens an allow-listed https URL in the system browser. */
  openExternal(url: string): Promise<boolean>;
}

/** IPC channel names used between preload and main. */
export const IpcChannel = {
  Rpc: 'syncvault:rpc',
  GetCoreState: 'syncvault:core-state:get',
  CoreState: 'syncvault:core-state',
  TrayAvailable: 'syncvault:tray-available',
  OpenExternal: 'syncvault:open-external',
} as const;
