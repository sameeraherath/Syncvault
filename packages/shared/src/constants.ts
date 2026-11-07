/** Data-safety defaults. See docs/DATA-SAFETY.md before changing any of these. */
export const DATA_SAFETY_DEFAULTS = {
  /** Syncvault's own check: pause and ask the user if a run would delete more files than this. */
  maxDeleteFiles: 50,
  /** bisync's built-in `--max-delete` check — a PERCENTAGE of files, not a count. */
  bisyncMaxDeletePercent: 50,
  /** Debounce for file-system events before a sync run is queued. */
  debounceMs: 3000,
} as const;

/** Environment variables Electron main uses to configure the core child process. */
export const CoreEnv = {
  RpcPath: 'SYNCVAULT_RPC_PATH',
  RpcToken: 'SYNCVAULT_RPC_TOKEN',
  AppDataDir: 'SYNCVAULT_APP_DATA',
  RcloneBinary: 'SYNCVAULT_RCLONE_BINARY',
  AppVersion: 'SYNCVAULT_APP_VERSION',
  LogLevel: 'SYNCVAULT_LOG_LEVEL',
} as const;

/** Line the core prints on stdout once the RPC server is listening. */
export const CORE_READY_LINE = 'SYNCVAULT_CORE_READY';
