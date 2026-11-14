import { describe, it, expect } from 'vitest';
import { Rng } from '../src/engine';

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });
  it('gaussian has mean ≈ 0 and variance ≈ 1', () => {
    const r = new Rng(7);
    const n = 20000;
    let s = 0;
    let s2 = 0;
    for (let i = 0; i < n; i++) {
      const x = r.gauss();
      s += x;
      s2 += x * x;
    }
    expect(Math.abs(s / n)).toBeLessThan(0.03);
    expect(Math.abs(s2 / n - 1)).toBeLessThan(0.05);
  });
});
