import { runScramble } from './scramble';
import { prepareDecrypt, runDecrypt } from './decrypt';
import { startFlow } from './flow';
import { initPointerEffects } from './lens';

/**
 * Page motion: scroll reveals, sticky-nav state, decrypt headlines, the connect-diagram flow and
 * pointer effects. Everything is optional — without JS (or with reduced motion) content is static,
 * readable and visible.
 */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.add('js');

// Headlines that decrypt on load (hero) are scrambled immediately, before they fade in.
if (!reduceMotion) {
  document.querySelectorAll<HTMLElement>('[data-decrypt="load"]').forEach((el) => {
    prepareDecrypt(el);
    runDecrypt(el, 1300, 450);
  });
}

const onVisible = (el: Element): void => {
  el.classList.add('is-visible');
  if (reduceMotion) return;
  el.querySelectorAll<HTMLElement>('[data-cipher]').forEach((c, i) =>
    setTimeout(() => void runScramble(c), 150 + i * 140),
  );
  el.querySelectorAll<HTMLElement>('[data-decrypt="reveal"]').forEach((d) =>
    runDecrypt(d, 1100, 250),
  );
};

const targets = document.querySelectorAll('[data-reveal]');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        onVisible(entry.target);
        io.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
  );
  targets.forEach((t) => io.observe(t));
} else {
  targets.forEach(onVisible);
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

const nav = document.querySelector('[data-nav]');
const updateNav = (): void => {
  nav?.classList.toggle('is-scrolled', window.scrollY > 8);
};
updateNav();
window.addEventListener('scroll', updateNav, { passive: true });
