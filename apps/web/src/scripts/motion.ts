import { runScramble } from './scramble';

/**
 * Page motion: scroll reveals, sticky-nav state and the ciphertext scramble.
 * Everything is optional — without JS (or with reduced motion) content is static and visible.
 */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const onVisible = (el: Element): void => {
  el.classList.add('is-visible');
  if (reduceMotion) return;
  el.querySelectorAll<HTMLElement>('[data-cipher]').forEach((c, i) =>
    setTimeout(() => runScramble(c), 150 + i * 140),
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

const nav = document.querySelector('[data-nav]');
const updateNav = (): void => {
  nav?.classList.toggle('is-scrolled', window.scrollY > 8);
};
updateNav();
window.addEventListener('scroll', updateNav, { passive: true });
