import { startFlow } from './flow';
import { initPointerEffects } from './lens';

/**
 * Page motion: scroll reveals, the auto-hiding nav, the connect-diagram flow and pointer effects.
 * Everything is optional — without JS (or with reduced motion) content is static and visible.
 */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.add('js');

const targets = document.querySelectorAll('[data-reveal]');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
  );
  targets.forEach((t) => io.observe(t));
} else {
  targets.forEach((t) => t.classList.add('is-visible'));
}

// Connect diagram: file chips (desktop stage and mobile column). Only the visible layout runs.
if (!reduceMotion) {
  document.querySelectorAll<HTMLElement>('[data-flow]').forEach((stage) => {
    const incoming = [...stage.querySelectorAll<SVGPathElement>('path[data-in]')];
    const outgoing = [...stage.querySelectorAll<SVGPathElement>('path[data-out]')];
    const vault = stage.querySelector<HTMLElement>('.vault');
    if (!incoming.length || !outgoing.length) return;
    stage.classList.add('has-chips');
    startFlow({
      stage,
      incoming,
      outgoing,
      names: incoming.map((p) => (p.dataset.names ?? '').split(',').filter(Boolean)),
      every: Number(stage.dataset.flow) || 1100,
      onVault: (busy) => vault?.classList.toggle('is-busy', busy),
    });
  });
}

initPointerEffects();

// Nav: frosted once scrolled; hides while scrolling down, comes back when scrolling up.
const nav = document.querySelector<HTMLElement>('[data-nav]');
if (nav) {
  let lastY = window.scrollY;
  let hidden = false;
  let queued = false;
  const update = (): void => {
    queued = false;
    const y = window.scrollY;
    const dy = y - lastY;
    nav.classList.toggle('is-scrolled', y > 8);
    if (y < 80) hidden = false;
    else if (dy > 6) hidden = true;
    else if (dy < -6) hidden = false;
    if (Math.abs(dy) > 6 || y < 80) lastY = y;
    nav.classList.toggle('is-hidden', hidden);
  };
  update();
  window.addEventListener(
    'scroll',
    () => {
      if (!queued) requestAnimationFrame(update);
      queued = true;
    },
    { passive: true },
  );
}
