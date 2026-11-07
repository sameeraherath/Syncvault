import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { IpcChannel, RpcErrorCode, err } from '@syncvault/shared';
import type { CoreSupervisor } from './core/supervisor.js';
import { isAppUrl, openExternalSafely } from './security.js';
import { validateRendererRpc } from './validate.js';

const isTrustedSender = (event: IpcMainInvokeEvent): boolean => {
  const url = event.senderFrame?.url;
  return typeof url === 'string' && isAppUrl(url);
};

export const registerIpc = (supervisor: CoreSupervisor, trayAvailable: boolean): void => {
  ipcMain.handle(IpcChannel.Rpc, async (event, method: unknown, params: unknown) => {
    if (!isTrustedSender(event)) {
      return err({ code: RpcErrorCode.Unauthorized, message: 'Untrusted sender' });
    }
    const valid = validateRendererRpc(method, params);
    if (!valid.ok) return valid;
    return supervisor.call(valid.value.method, valid.value.params);
  });

  ipcMain.handle(IpcChannel.GetCoreState, (event) =>
    isTrustedSender(event) ? supervisor.state : { state: 'stopped' },
  );

  ipcMain.handle(IpcChannel.TrayAvailable, (event) => isTrustedSender(event) && trayAvailable);

  ipcMain.handle(IpcChannel.OpenExternal, (event, url: unknown) =>
    isTrustedSender(event) ? openExternalSafely(url) : false,
  );
};
