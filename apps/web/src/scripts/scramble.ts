/** Characters used while "encrypting" — looks like rclone crypt's base32 names. */
export const SCRAMBLE_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * One frame of the scramble effect: the first `progress` share of `target` is settled,
 * the rest is random. Spaces, dots and slashes are kept so the shape stays readable.
 */
export const scrambleFrame = (
  target: string,
  progress: number,
  random: () => number = Math.random,
  alphabet: string = SCRAMBLE_ALPHABET,
): string => {
  const settled = Math.floor(Math.min(1, Math.max(0, progress)) * target.length);
  let out = '';
  for (let i = 0; i < target.length; i++) {
    const ch = target.charAt(i);
    if (i < settled || /[\s./…—-]/.test(ch)) {
      out += ch;
    } else {
      out += alphabet.charAt(Math.floor(random() * alphabet.length));
    }
  }
  return out;
};

/** A random ciphertext-looking name, e.g. `k3v9q0x7m2a1`. */
export const randomCipher = (length: number, random: () => number = Math.random): string =>
  scrambleFrame('x'.repeat(length), 0, random);

/** Animates an element's text from noise to its final value. */
export const runScramble = (el: HTMLElement, durationMs = 900): Promise<void> =>
  new Promise((resolve) => {
    const target = el.dataset.cipher ?? el.textContent ?? '';
    const start = performance.now();
    const tick = (now: number): void => {
      const progress = (now - start) / durationMs;
      el.textContent = scrambleFrame(target, progress);
      if (progress < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
