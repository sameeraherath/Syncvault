import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IpcChannel, type CoreState, type SyncvaultBridge } from '@syncvault/shared';

/** Minimal, typed bridge. Never expose ipcRenderer or Node APIs directly. */
const bridge: SyncvaultBridge = {
  rpc: (method, params) => ipcRenderer.invoke(IpcChannel.Rpc, method, params),
  getCoreState: () => ipcRenderer.invoke(IpcChannel.GetCoreState),
  onCoreState: (listener) => {
    const handler = (_event: IpcRendererEvent, state: CoreState): void => listener(state);
    ipcRenderer.on(IpcChannel.CoreState, handler);
    return () => {
      ipcRenderer.removeListener(IpcChannel.CoreState, handler);
    };
  },
  isTrayAvailable: () => ipcRenderer.invoke(IpcChannel.TrayAvailable),
  openExternal: (url) => ipcRenderer.invoke(IpcChannel.OpenExternal, url),
};

contextBridge.exposeInMainWorld('syncvault', bridge);
