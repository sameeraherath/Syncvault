/**
 * Pointer-driven effects. Values are written as CSS custom properties through CSSOM
 * (allowed by the strict CSP — no inline style attributes in the HTML).
 *  - [data-lens]: the privacy "key lens" — plaintext revealed under the pointer.
 *  - .spot: soft spotlight that follows the pointer on cards.
 *  - [data-tilt]: gentle 3D tilt towards the pointer.
 */
export const initPointerEffects = (): void => {
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  document.querySelectorAll<HTMLElement>('[data-lens]').forEach((lens) => {
    const button = lens.querySelector<HTMLButtonElement>('[data-lens-toggle]');
    button?.addEventListener('click', () => {
      const unlocked = lens.classList.toggle('is-unlocked');
      button.setAttribute('aria-pressed', String(unlocked));
    });
    if (!finePointer) return;
    const area = lens.querySelector<HTMLElement>('[data-lens-area]') ?? lens;
    area.addEventListener('pointermove', (e) => {
      const r = area.getBoundingClientRect();
      area.style.setProperty('--lx', `${e.clientX - r.left}px`);
      area.style.setProperty('--ly', `${e.clientY - r.top}px`);
      lens.classList.add('is-peeking');
    });
    area.addEventListener('pointerleave', () => lens.classList.remove('is-peeking'));
  });

  if (!finePointer) return;

  let pending: PointerEvent | null = null;
  const apply = (): void => {
    const e = pending;
    pending = null;
    if (!e || !(e.target instanceof Element)) return;
    const spot = e.target.closest<HTMLElement>('.spot');
    if (spot) {
      const r = spot.getBoundingClientRect();
      spot.style.setProperty('--mx', `${e.clientX - r.left}px`);
      spot.style.setProperty('--my', `${e.clientY - r.top}px`);
    }
  };
  document.addEventListener(
    'pointermove',
    (e) => {
      if (!pending) requestAnimationFrame(apply);
      pending = e;
    },
    { passive: true },
  );

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((el) => {
    const target = el.firstElementChild as HTMLElement | null;
    if (!target) return;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      target.style.setProperty('--ry', `${(x * 6).toFixed(2)}deg`);
      target.style.setProperty('--rx', `${(-y * 4).toFixed(2)}deg`);
    });
    el.addEventListener('pointerleave', () => {
      target.style.setProperty('--ry', '0deg');
      target.style.setProperty('--rx', '0deg');
    });
  });
};
