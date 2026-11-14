import { describe, it, expect } from 'vitest';
import { Simulation, DEFAULT_CONFIG } from '../src/engine';

describe('simulation', () => {
  it('steps 1800 s in under 1.5 s', () => {
    const sim = new Simulation(DEFAULT_CONFIG, 1);
    const t = performance.now();
    for (let i = 0; i < 1800; i++) sim.step();
    expect(performance.now() - t).toBeLessThan(process.env.CI ? 5000 : 1500); // relaxed on shared CI runners
  });
  it('injecting then clearing a fault restores trust to GOOD within a bounded time', () => {
    const sim = new Simulation(DEFAULT_CONFIG, 2);
    for (let i = 0; i < 200; i++) sim.step();
    const id = sim.injectFault({ type: 'stuck', channel: 7 });
    for (let i = 0; i < 300; i++) sim.step();
    expect(sim.trust.states[7].cls).toBe('BAD');
    sim.clearFault(id);
    let recovered = -1;
    for (let i = 0; i < 400; i++) {
      sim.step();
      if (sim.trust.states[7].cls === 'GOOD') {
        recovered = i;
        break;
      }
    }
    expect(recovered).toBeGreaterThan(0);
    expect(recovered).toBeLessThan(300);
  });
  it('snapshot exposes live state', () => {
    const sim = new Simulation(DEFAULT_CONFIG, 3);
    sim.injectFault({ type: 'pumpTrip', node: 4 });
    for (let i = 0; i < 150; i++) sim.step();
    const s = sim.snapshot();
    expect(s.rawTotal).toBeGreaterThan(0);
    expect(s.faults.length).toBe(1);
    expect(s.trust.length).toBe(15);
    expect(s.waves.length).toBe(1);
  });
});
