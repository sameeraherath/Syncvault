export const MAX_CORE_RESTARTS = 5;
/** After the core has run this long, the restart counter resets. */
export const CORE_STABLE_AFTER_MS = 60_000;

/** Exponential backoff: 1s, 2s, 4s, 8s, 16s … capped at 30s. `attempt` starts at 1. */
export const restartDelayMs = (attempt: number): number =>
  Math.min(1000 * 2 ** Math.max(0, attempt - 1), 30_000);
