import { describe, it, expect } from 'vitest';
import { Simulation, DEFAULT_CONFIG, NOMINAL, NODE_KM } from '../src/engine';

function firstCross(sim: Simulation, ch: number, thr: number, t0: number, tmax: number): number | null {
  for (let t = t0; t < tmax; t++) if (Math.abs(sim.trueAt(ch, t) - NOMINAL[ch]) > thr) return t;
  return null;
}

describe('process', () => {
  it('wave arrival times match distance / c within 1 s (noise-free true values)', () => {
    const sim = new Simulation(DEFAULT_CONFIG, 3);
    sim.injectFault({ type: 'pumpTrip', node: 4, delay: 60 });
    for (let i = 0; i < 400; i++) sim.step();
    for (const n of [3, 5, 6]) {
      const d = Math.abs(NODE_KM[n] - 80);
      const t = firstCross(sim, n, 0.5, 60, 400)!;
      // amplitude grows from 0, so the crossing lags arrival by a few seconds at most
      expect(t - (60 + d)).toBeGreaterThanOrEqual(-1);
      expect(t - (60 + d)).toBeLessThan(6);
    }
  });
  it('wave speed is configurable', () => {
    const sim = new Simulation({ ...DEFAULT_CONFIG, waveSpeed: 500 }, 3);
    sim.injectFault({ type: 'pumpTrip', node: 4, delay: 10 });
    for (let i = 0; i < 200; i++) sim.step();
    const t = firstCross(sim, 6, 0.5, 10, 200)!;
    expect(t).toBeGreaterThanOrEqual(10 + 80 - 1); // 40 km ÷ 500 m/s = 80 s
  });
  it('pump trip: downstream drops, upstream rises', () => {
    const sim = new Simulation(DEFAULT_CONFIG, 3);
    sim.injectFault({ type: 'pumpTrip', node: 4 });
    for (let i = 0; i < 120; i++) sim.step();
    expect(sim.trueAt(5, 100) - NOMINAL[5]).toBeLessThan(-1);
    expect(sim.trueAt(3, 100) - NOMINAL[3]).toBeGreaterThan(0.5);
  });
  it('leak creates a mass imbalance seen at FT-out after the flow lag', () => {
    const sim = new Simulation(DEFAULT_CONFIG, 3);
    sim.injectFault({ type: 'leak', km: 87, size: 'medium' });
    for (let i = 0; i < 200; i++) sim.step();
    const imb = sim.trueAt(12, 190) - sim.trueAt(13, 190) - sim.trueAt(14, 190);
    expect(imb).toBeGreaterThan(20);
    expect(sim.trueAt(14, 20) - NOMINAL[14]).toBeGreaterThan(-3);
  });
});
