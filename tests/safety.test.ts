import { describe, it, expect } from 'vitest';
import { Simulation, SCENARIOS, DEFAULT_CONFIG, scenarioById } from '../src/engine';
import { readdirSync, readFileSync } from 'node:fs';

describe('safety rules', () => {
  it('critical alarms hidden = 0 and every raw alarm is linked, across scenarios and seeds', () => {
    for (const sc of SCENARIOS) {
      for (const seed of [sc.defaultSeed, sc.defaultSeed + 100, sc.defaultSeed + 200]) {
        const r = Simulation.runHeadless(sc, seed, DEFAULT_CONFIG);
        expect(r.criticalHidden, `${sc.id}/${seed}`).toBe(0);
        expect(r.retainedPct, `${sc.id}/${seed}`).toBe(100);
        for (const a of r.alarms) if (a.source === 'scada') expect(a.incidentId !== undefined || a.advisoryId !== undefined, `${sc.id} alarm ${a.id}`).toBe(true);
        // safety-critical alarms lead their incident's headline
        for (const inc of r.incidents) {
          const crit = inc.alarmIds.map((id) => r.alarms.find((a) => a.id === id)).filter((a) => a?.safetyCritical);
          if (crit.length) expect(r.alarms.find((a) => a.id === inc.headlineIds[0])?.safetyCritical).toBe(true);
        }
      }
    }
  });
  it('fail-open: engine OFF ⇒ operator list equals the raw list', () => {
    const sc = scenarioById('S1');
    const sim = new Simulation({ ...DEFAULT_CONFIG, engineEnabled: false }, sc.defaultSeed);
    sim.runScenario(sc);
    for (let i = 0; i < 900; i++) sim.step();
    expect(sim.agg.all().length).toBe(0);
    expect(sim.opTotal).toBe(sim.generated);
    expect(sim.alarmLog.every((a) => a.role === 'passthrough')).toBe(true);
  });
  it('toggling the engine off mid-run closes incidents and passes alarms straight through', () => {
    const sc = scenarioById('S1');
    const sim = new Simulation(DEFAULT_CONFIG, sc.defaultSeed);
    sim.runScenario(sc);
    for (let i = 0; i < 400; i++) sim.step();
    expect(sim.agg.open.length).toBeGreaterThan(0);
    sim.setConfig({ engineEnabled: false });
    expect(sim.agg.open.length).toBe(0);
    const before = sim.generated;
    for (let i = 0; i < 100; i++) sim.step();
    expect(sim.generated).toBeGreaterThan(before);
    expect(sim.snapshot().engineEnabled).toBe(false);
  });
  it('no engine source emits a control command', () => {
    const dir = 'src/engine';
    for (const f of readdirSync(dir)) {
      const src = readFileSync(`${dir}/${f}`, 'utf8');
      expect(/sendControl|issueCommand|setpointWrite|openValve\(|closeValve\(|startPump|stopPump/.test(src), f).toBe(false);
    }
  });
});
