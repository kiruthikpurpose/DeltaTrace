import { describe, it, expect } from 'vitest';
import { Simulation, DEFAULT_CONFIG } from '../src/engine';

const run = (setup: (s: Simulation) => void, secs: number, seed = 5) => {
  const sim = new Simulation(DEFAULT_CONFIG, seed);
  setup(sim);
  for (let i = 0; i < secs; i++) sim.step();
  return sim;
};

describe('trust engine', () => {
  it('healthy sensors stay GOOD', () => {
    const sim = new Simulation(DEFAULT_CONFIG, 5);
    for (let i = 0; i < 1500; i++) {
      sim.step();
      if (sim.t > 100 && sim.t % 5 === 0) for (const s of sim.trust.states) expect(s.cls).toBe('GOOD');
    }
  });
  it('stuck sensor → not GOOD with likely fault "stuck"', () => {
    const sim = run((s) => s.injectFault({ type: 'stuck', channel: 7, delay: 100 }), 400);
    const st = sim.trust.states[7];
    expect(st.cls).toBe('BAD');
    expect(st.likelyFault).toBe('stuck');
  });
  it('replayed data is detected', () => {
    const sim = run((s) => s.injectFault({ type: 'replay', channel: 3, delay: 400 }), 800);
    expect(sim.trust.states[3].likelyFault).toBe('replay');
    expect(sim.trust.states[3].cls).not.toBe('GOOD');
  });
  it('comms outage → stale / BAD', () => {
    const sim = run((s) => s.injectFault({ type: 'comms', channels: [6, 7], delay: 100 }), 260);
    for (const ch of [6, 7]) {
      expect(sim.trust.states[ch].likelyFault).toBe('stale');
      expect(sim.trust.states[ch].cls).toBe('BAD');
    }
  });
  it('a real event seen by several neighbours does not push healthy sensors to BAD', () => {
    for (const spec of [{ type: 'pumpTrip', node: 4 }, { type: 'leak', km: 87 }, { type: 'valveClosure', node: 5 }] as const) {
      const sim = new Simulation(DEFAULT_CONFIG, 9);
      sim.injectFault({ ...spec, delay: 200 });
      for (let i = 0; i < 900; i++) {
        sim.step();
        if (sim.t % 5 === 0) for (let ch = 0; ch < 15; ch++) expect(sim.trust.states[ch].cls, `${spec.type} ch${ch} t${sim.t}`).not.toBe('BAD');
      }
    }
  });
  it('hysteresis: leaves BAD only after T ≥ 0.55 for 3 consecutive scans', () => {
    const sim = new Simulation(DEFAULT_CONFIG, 5);
    sim.injectFault({ type: 'stuck', channel: 7, delay: 100, duration: 200 });
    let wasBad = false;
    let recovered = -1;
    let above = 0;
    for (let i = 0; i < 900; i++) {
      sim.step();
      if (sim.t % 5) continue;
      const st = sim.trust.states[7];
      if (st.cls === 'BAD') wasBad = true;
      else if (wasBad && recovered < 0) {
        recovered = sim.t;
        expect(above).toBeGreaterThanOrEqual(2);
      }
      above = st.T >= 0.55 && st.cls === 'BAD' ? above + 1 : st.cls === 'BAD' ? 0 : above;
    }
    expect(wasBad).toBe(true);
    expect(recovered).toBeGreaterThan(0);
  });
});
