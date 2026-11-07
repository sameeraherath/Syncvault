/** Typed result used at process / module boundaries instead of throwing. */
export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

export interface AppError {
  code: string;
  message: string;
}

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E = AppError>(error: E): Result<never, E> => ({ ok: false, error });
