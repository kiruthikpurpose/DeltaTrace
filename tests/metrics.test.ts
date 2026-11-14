import { describe, it, expect } from 'vitest';
import { computeKpis, peakWindow, rollingCounts, Simulation, scenarioById, DEFAULT_CONFIG } from '../src/engine';

describe('metrics', () => {
  it('detects floods and peak windows', () => {
    const burst = Array.from({ length: 12 }, (_, i) => 100 + i * 10);
    expect(peakWindow(burst)).toBe(12);
    const k = computeKpis(burst, 1800);
    expect(k.peak10).toBe(12);
    expect(k.pctTimeInFlood).toBeGreaterThan(0);
    expect(computeKpis([], 1800).pctTimeInFlood).toBe(0);
  });
  it('rolling counts use a 10-minute window', () => {
    const c = rollingCounts([0, 100, 700], 0, 800, 100);
    expect(Math.max(...c)).toBe(2);
    expect(c[c.length - 1]).toBe(1);
  });
  it('time to first correct incident is small on S2', () => {
    const r = Simulation.runHeadless(scenarioById('S2'), 13, DEFAULT_CONFIG);
    expect(r.timeToFirstCorrect).not.toBeNull();
    expect(r.timeToFirstCorrect!).toBeLessThan(60);
    expect(r.classAccuracy).toBe(100);
  });
});
