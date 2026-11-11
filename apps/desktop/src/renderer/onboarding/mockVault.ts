import { ok, type AppError, type Result } from '@syncvault/shared';

/**
 * MOCK VAULT — UI preview only. It does no cryptography and protects nothing.
 *
 * TODO(vault): replace with RPC 'vault.create' once the core vault exists
 * (Argon2id, keys in memory only, OS keychain — see CLAUDE.md "Security rules").
 * Never write crypto here.
 */

export const IS_MOCK_VAULT = true;

/** Obviously fake, so nobody mistakes it for a real recovery key. */
const DEMO_RECOVERY_KEY = 'DEMO-0000-0000-0000-0000-0000-0000-0000';

export const createVault = async (
  _password: string,
): Promise<Result<{ recoveryKey: string }, AppError>> => {
  // The password is intentionally ignored: not stored, not logged, not sent anywhere.
  return ok({ recoveryKey: DEMO_RECOVERY_KEY });
};
