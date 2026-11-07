import { z } from 'zod';

/** Lifecycle of the core child process as seen by Electron main (pushed to the renderer). */
export const coreStateSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('starting') }),
  z.object({ state: z.literal('connected') }),
  z.object({
    state: z.literal('restarting'),
    attempt: z.number().int(),
    maxAttempts: z.number().int(),
    message: z.string(),
  }),
  z.object({ state: z.literal('failed'), message: z.string() }),
  z.object({ state: z.literal('stopped') }),
]);
export type CoreState = z.infer<typeof coreStateSchema>;
