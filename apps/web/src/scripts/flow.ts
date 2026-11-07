import { randomCipher } from './scramble';

/**
 * Connect-diagram "file chips": a readable file name travels from a file card into Syncvault,
 * gets scrambled while it passes behind the vault, and leaves as blue ciphertext towards a cloud.
 * Positions come from the SVG paths (getPointAtLength + getScreenCTM), so chips follow the drawn
 * lines at any size. One rAF loop; paused when off-screen or when the tab is hidden.
 */

export interface TripTimings {
  /** ms travelling along the incoming line. */
  in: number;
  /** ms hidden behind the vault (being encrypted). */
  vault: number;
  /** ms travelling along the outgoing line. */
  out: number;
}

export type TripPhase =
  | { phase: 'in'; t: number }
  | { phase: 'vault'; t: number }
  | { phase: 'out'; t: number }
  | { phase: 'done' };

export const DEFAULT_TIMINGS: TripTimings = { in: 1500, vault: 700, out: 1600 };

/** Which part of the trip a chip is in after `elapsed` ms, with local progress 0..1. */
export const tripPhase = (elapsed: number, timings: TripTimings = DEFAULT_TIMINGS): TripPhase => {
  if (elapsed < 0) return { phase: 'in', t: 0 };
  if (elapsed < timings.in) return { phase: 'in', t: elapsed / timings.in };
  const e2 = elapsed - timings.in;
  if (e2 < timings.vault) return { phase: 'vault', t: e2 / timings.vault };
  const e3 = e2 - timings.vault;
  if (e3 < timings.out) return { phase: 'out', t: e3 / timings.out };
  return { phase: 'done' };
};

export const easeInOut = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

interface Point {
  x: number;
  y: number;
}

/** Point on an SVG path at progress t, in coordinates relative to `origin`. */
const pointOn = (path: SVGPathElement, t: number, origin: DOMRect): Point => {
  const p = path.getPointAtLength(path.getTotalLength() * t);
  const ctm = path.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const s = new DOMPoint(p.x, p.y).matrixTransform(ctm);
  return { x: s.x - origin.left, y: s.y - origin.top };
};

interface Trip {
  el: HTMLElement;
  label: HTMLElement;
  from: SVGPathElement;
  to: SVGPathElement;
  start: number;
  plain: string;
  cipher: string;
  locked: boolean;
}

export interface FlowOptions {
  /** Positioned container the chips live in (chips are absolutely positioned inside). */
  stage: HTMLElement;
  incoming: SVGPathElement[];
  outgoing: SVGPathElement[];
  /** File names to send per incoming path (same order). */
  names: string[][];
  /** ms between new trips. */
  every?: number;
  /** Called while a chip is inside the vault. */
  onVault?: (busy: boolean) => void;
}

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)] as T;

export const startFlow = (opts: FlowOptions): void => {
  const { stage, incoming, outgoing, names } = opts;
  const every = opts.every ?? 1100;
  const trips: Trip[] = [];
  let running = false;
  let visible = false;
  let lastSpawn = -Infinity;
  let raf = 0;

  const layer = document.createElement('div');
  layer.className = 'chip-layer';
  layer.setAttribute('aria-hidden', 'true');
  stage.append(layer);

  const spawn = (now: number): void => {
    const i = Math.floor(Math.random() * incoming.length);
    const from = incoming[i];
    const to = pick(outgoing);
    if (!from || !to) return;
    const plain = pick(names[i] ?? ['file.txt']);
    const el = document.createElement('div');
    el.className = 'chip';
    const icon = document.createElement('span');
    icon.className = 'chip-icon';
    const label = document.createElement('span');
    label.textContent = plain;
    el.append(icon, label);
    layer.append(el);
    trips.push({
      el,
      label,
      from,
      to,
      start: now,
      plain,
      cipher: randomCipher(8) + '…',
      locked: false,
    });
  };

  const frame = (now: number): void => {
    if (!running) return;
    if (now - lastSpawn > every && trips.length < 5) {
      spawn(now);
      lastSpawn = now;
    }
    const origin = stage.getBoundingClientRect();
    let busy = false;
    for (let k = trips.length - 1; k >= 0; k--) {
      const trip = trips[k] as Trip;
      const ph = tripPhase(now - trip.start);
      let p: Point;
      if (ph.phase === 'done') {
        trip.el.remove();
        trips.splice(k, 1);
        continue;
      } else if (ph.phase === 'in') {
        p = pointOn(trip.from, easeInOut(ph.t), origin);
      } else if (ph.phase === 'vault') {
        busy = true;
        const a = pointOn(trip.from, 1, origin);
        const b = pointOn(trip.to, 0, origin);
        p = { x: a.x + (b.x - a.x) * ph.t, y: a.y + (b.y - a.y) * ph.t };
        if (!trip.locked && ph.t > 0.35) {
          trip.locked = true;
          trip.el.classList.add('is-locked');
          trip.label.textContent = trip.cipher;
        }
      } else {
        p = pointOn(trip.to, easeInOut(ph.t), origin);
        trip.el.classList.toggle('is-leaving', ph.t > 0.82);
      }
      trip.el.style.setProperty('--cx', `${p.x.toFixed(1)}px`);
      trip.el.style.setProperty('--cy', `${p.y.toFixed(1)}px`);
    }
    opts.onVault?.(busy);
    raf = requestAnimationFrame(frame);
  };

  const update = (): void => {
    const shouldRun = visible && document.visibilityState === 'visible';
    if (shouldRun && !running) {
      running = true;
      raf = requestAnimationFrame(frame);
    } else if (!shouldRun && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  };

  new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    update();
  }).observe(stage);
  document.addEventListener('visibilitychange', update);
};
