import { err, ok, type Account, type FileListResult, type Result } from '@syncvault/shared';

/**
 * Where the Files page gets its data. The page only talks to this interface, so the real core
 * (rpcSource) and the dev-only demo data (files/mockFiles.ts) are interchangeable.
 * Errors are plain messages for display.
 */
export interface FilesSource {
  listAccounts(): Promise<Result<Account[], string>>;
  listFiles(accountId: string, path: string): Promise<Result<FileListResult, string>>;
}

export const rpcSource: FilesSource = {
  listAccounts: async () => {
    const res = await window.syncvault.rpc('accounts.list');
    return res.ok ? ok(res.value.accounts) : err(res.error.message);
  },
  listFiles: async (accountId, path) => {
    const res = await window.syncvault.rpc('files.list', { accountId, path });
    return res.ok ? ok(res.value) : err(res.error.message);
  },
};
