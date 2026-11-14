import { describe, it, expect } from 'vitest';
import { Simulation, DEFAULT_CONFIG, scenarioById, estimateOrigin } from '../src/engine';

describe('origin estimate', () => {
  it('leak at km 87 is estimated within ±6 km on S2 (several seeds)', () => {
    const sc = scenarioById('S2');
    for (const seed of [13, 14, 15, 16, 17]) {
      const r = Simulation.runHeadless(sc, seed, DEFAULT_CONFIG);
      const inc = r.incidents.find((i) => i.cls === 'process-event')!;
      expect(inc.origin).toBeTruthy();
      expect(Math.abs(inc.origin!.km - 87)).toBeLessThanOrEqual(6);
    }
  });
  it('perfect arrival times recover the origin exactly', () => {
    const pts = [40, 60, 80, 100, 120].map((km) => ({ km, t: 10 + Math.abs(km - 87), w: 1 }));
    const o = estimateOrigin(pts, 1000)!;
    expect(Math.abs(o.km - 87)).toBeLessThanOrEqual(0.5);
  });
  it('returns null with too little data', () => {
    expect(estimateOrigin([{ km: 20, t: 1, w: 1 }], 1000)).toBeNull();
  });
});
