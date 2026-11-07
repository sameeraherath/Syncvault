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
): string => {
  const settled = Math.floor(Math.min(1, Math.max(0, progress)) * target.length);
  let out = '';
  for (let i = 0; i < target.length; i++) {
    const ch = target.charAt(i);
    if (i < settled || /[\s./…]/.test(ch)) {
      out += ch;
    } else {
      out += SCRAMBLE_ALPHABET.charAt(Math.floor(random() * SCRAMBLE_ALPHABET.length));
    }
  }
  return out;
};

/** Animates an element's text from noise to its final value. */
export const runScramble = (el: HTMLElement, durationMs = 900): void => {
  const target = el.dataset.cipher ?? el.textContent ?? '';
  const start = performance.now();
  const tick = (now: number): void => {
    const progress = (now - start) / durationMs;
    el.textContent = scrambleFrame(target, progress);
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
