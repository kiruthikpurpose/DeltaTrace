import { describe, it, expect } from 'vitest';
import { Simulation, SCENARIOS, DEFAULT_CONFIG, scenarioById } from '../src/engine';

describe('scenarios', () => {
  it('baseline floods in S1 and S8 and DeltaTrace shows far fewer items', () => {
    for (const id of ['S1', 'S8']) {
      const r = Simulation.runHeadless(scenarioById(id), scenarioById(id).defaultSeed, DEFAULT_CONFIG);
      expect(r.kpiRaw.peak10, id).toBeGreaterThanOrEqual(10);
      expect(r.kpiOp.peak10, id).toBeLessThan(r.kpiRaw.peak10 / 3);
    }
  });
  it('baseline floods on a leak with several sensors (S2) and the comms+leak case (S6)', () => {
    for (const id of ['S2', 'S6']) expect(Simulation.runHeadless(scenarioById(id), scenarioById(id).defaultSeed, DEFAULT_CONFIG).kpiRaw.peak10).toBeGreaterThanOrEqual(10);
  });
  it('S0 and S7 have no true process events', () => {
    for (const id of ['S0', 'S7']) expect(scenarioById(id).truth.filter((t) => t.kind === 'process').length).toBe(0);
    const r = Simulation.runHeadless(scenarioById('S7'), 18, DEFAULT_CONFIG);
    expect(r.incidents.filter((i) => i.cls === 'process-event').length).toBe(0);
  });
  it('is deterministic for a fixed seed', () => {
    const a = Simulation.runHeadless(scenarioById('S8'), 19, DEFAULT_CONFIG);
    const b = Simulation.runHeadless(scenarioById('S8'), 19, DEFAULT_CONFIG);
    expect(a.rawTotal).toBe(b.rawTotal);
    expect(a.alarms.map((x) => x.id + x.tag + x.time).join()).toBe(b.alarms.map((x) => x.id + x.tag + x.time).join());
    expect(a.incidents.map((i) => i.cls + i.alarmIds.length).join()).toBe(b.incidents.map((i) => i.cls + i.alarmIds.length).join());
  });
  it('lists S0–S8', () => {
    expect(SCENARIOS.map((s) => s.id)).toEqual(['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8']);
  });
});
