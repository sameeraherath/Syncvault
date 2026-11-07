import { describe, expect, it } from 'vitest';
import { DEFAULT_TIMINGS, easeInOut, tripPhase } from './flow';

describe('tripPhase', () => {
  const t = { in: 1000, vault: 500, out: 1000 };

  it('walks through in → vault → out → done', () => {
    expect(tripPhase(0, t)).toEqual({ phase: 'in', t: 0 });
    expect(tripPhase(500, t)).toEqual({ phase: 'in', t: 0.5 });
    expect(tripPhase(1250, t)).toEqual({ phase: 'vault', t: 0.5 });
    expect(tripPhase(2000, t)).toEqual({ phase: 'out', t: 0.5 });
    expect(tripPhase(2500, t)).toEqual({ phase: 'done' });
  });

  it('clamps negative time to the start', () => {
    expect(tripPhase(-10)).toEqual({ phase: 'in', t: 0 });
  });

  it('has sensible defaults', () => {
    expect(DEFAULT_TIMINGS.in).toBeGreaterThan(0);
  });
});

describe('easeInOut', () => {
  it('maps 0→0, 0.5→0.5, 1→1 and is monotonic', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.3)).toBeLessThan(easeInOut(0.6));
  });
});
