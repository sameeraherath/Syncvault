import { scrambleFrame } from './scramble';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/**
 * "Decrypt" effect for headlines: `[data-decrypt]` text starts as noise and resolves left to right.
 * The real text stays in the DOM (transparent) to keep layout stable and to be read by screen
 * readers; the animated noise is an aria-hidden overlay that is removed when done.
 */
/** Only single-line headlines decrypt: wrapped lines would re-wrap differently while scrambled. */
const isSingleLine = (el: HTMLElement): boolean => el.getClientRects().length <= 1;

export const prepareDecrypt = (el: HTMLElement): void => {
  if (el.dataset.decryptReady || !isSingleLine(el)) return;
  el.dataset.decryptReady = '1';
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  el.dataset.decryptText = text;
  const overlay = document.createElement('span');
  overlay.className = 'decrypt-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.textContent = scrambleFrame(text, 0, Math.random, LETTERS);
  el.classList.add('is-decrypting');
  el.append(overlay);
};

export const runDecrypt = (el: HTMLElement, durationMs = 1200, delayMs = 0): void => {
  prepareDecrypt(el);
  const overlay = el.querySelector<HTMLElement>('.decrypt-overlay');
  if (!overlay) return;
  const plain = el.dataset.decryptText ?? '';
  let start = 0;
  let last = 0;
  const tick = (now: number): void => {
    start ||= now + delayMs;
    const progress = (now - start) / durationMs;
    // Re-roll the noise ~30 times per second, not every frame.
    if (now - last > 33 || progress >= 1) {
      overlay.textContent = scrambleFrame(plain, progress, Math.random, LETTERS);
      last = now;
    }
    if (progress < 1) requestAnimationFrame(tick);
    else {
      overlay.remove();
      el.classList.remove('is-decrypting');
    }
  };
  requestAnimationFrame(tick);
};
