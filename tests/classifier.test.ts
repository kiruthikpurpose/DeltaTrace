import { describe, it, expect } from 'vitest';
import { Simulation, SCENARIOS, DEFAULT_CONFIG, scenarioById } from '../src/engine';

const run = (id: string) => Simulation.runHeadless(scenarioById(id), scenarioById(id).defaultSeed, DEFAULT_CONFIG);

describe('classifier on scenarios', () => {
  it('S1 / S2 → process-event', () => {
    for (const id of ['S1', 'S2']) {
      const r = run(id);
      expect(r.incidents.length).toBe(1);
      expect(r.incidents[0].cls).toBe('process-event');
    }
  });
  it('stuck PT → instrument advisory (no incident for the fault itself)', () => {
    const sim = new Simulation(DEFAULT_CONFIG, 4);
    sim.injectFault({ type: 'stuck', channel: 7, delay: 100 });
    for (let i = 0; i < 600; i++) sim.step();
    expect(sim.agg.advisories.length).toBeGreaterThan(0);
    expect(sim.agg.advisories.every((a) => a.tag === 'PT-7')).toBe(true);
    expect(sim.agg.all().filter((i) => i.cls === 'process-event').length).toBe(0);
  });
  it('S4 / S5 → data-integrity or instrument-fault, never process-event for the sensor fault', () => {
    const s5 = run('S5');
    expect(s5.incidents.length).toBeGreaterThan(0);
    for (const i of s5.incidents) expect(['data-integrity', 'instrument-fault']).toContain(i.cls);
    const s4 = run('S4');
    const spoof = s4.incidents.find((i) => i.channels.includes(3))!;
    expect(spoof.cls).toBe('data-integrity');
    expect(s4.incidents.some((i) => i.cls === 'process-event')).toBe(true);
  });
  it('S6 → one data-integrity + one process-event, separated', () => {
    const r = run('S6');
    expect(r.incidents.filter((i) => i.cls === 'data-integrity').length).toBe(1);
    expect(r.incidents.filter((i) => i.cls === 'process-event').length).toBe(1);
  });
  it('S0 raises nothing', () => {
    expect(run('S0').rawTotal).toBe(0);
  });
  it('all scenarios have ground-truth metadata', () => {
    for (const s of SCENARIOS) expect(s.duration).toBe(1800);
  });
});

describe('diagnostic alarms stay separate from process alarms', () => {
  it('a comms outage next to a leak does not turn the leak into a data-integrity incident', () => {
    const sim = new Simulation(DEFAULT_CONFIG, 77);
    sim.injectFault({ type: 'comms', channels: [6, 7, 8], delay: 60, duration: 240 });
    sim.injectFault({ type: 'leak', km: 60, size: 'medium', delay: 80 });
    for (let i = 0; i < 500; i++) sim.step();
    const incs = sim.agg.all();
    const leak = incs.find((i) => i.cls === 'process-event');
    const comms = incs.find((i) => i.cls === 'data-integrity');
    expect(leak).toBeTruthy();
    expect(comms).toBeTruthy();
    for (const id of comms!.alarmIds) expect(sim.agg.alarms.get(id)!.type).toBe('COMM');
  });
});
