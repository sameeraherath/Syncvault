import { useEffect, useState } from 'react';
import type { CoreState } from '@syncvault/shared';

/** Live state of the core service connection (starting / connected / restarting / …). */
export const useCoreState = (): CoreState => {
  const [core, setCore] = useState<CoreState>({ state: 'starting' });
  useEffect(() => {
    void window.syncvault.getCoreState().then(setCore);
    return window.syncvault.onCoreState(setCore);
  }, []);
  return core;
};
