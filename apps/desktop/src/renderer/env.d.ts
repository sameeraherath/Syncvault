/// <reference types="vite/client" />
import type { SyncvaultBridge } from '@syncvault/shared';

declare global {
  interface Window {
    syncvault: SyncvaultBridge;
  }
}
