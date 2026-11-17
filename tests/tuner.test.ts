import { describe, it, expect } from 'vitest';
import { generateTraining, runTuner, evaluateSetting, applyProposal, TUNER_CLASSES, DEFAULT_CONFIG, settingOf, Simulation } from '../src/engine';

describe('tuner', () => {
  it('recommendations have missed = 0; Pareto front is non-dominated; gating OFF is not better on clean data', async () => {
    const ts = generateTraining();
    expect(ts.events.length).toBeGreaterThanOrEqual(8);
    for (const c of TUNER_CLASSES) {
      const g = await runTuner(ts, c.id, DEFAULT_CONFIG, { gate: true });
      expect(g.candidates.length).toBeLessThanOrEqual(175);
      if (g.recommended) expect(g.recommended.missed).toBe(0);
      const front = g.candidates.filter((x) => x.pareto);
      for (const a of front) for (const b of front) if (a !== b) expect(b.meanDelay <= a.meanDelay && b.alarmsPer10 <= a.alarmsPer10 && (b.meanDelay < a.meanDelay || b.alarmsPer10 < a.alarmsPer10)).toBe(false);
      const u = await runTuner(ts, c.id, DEFAULT_CONFIG, { gate: false });
      if (g.proposal && u.proposal) {
        const cur = settingOf(DEFAULT_CONFIG, c.id);
        const jg = evaluateSetting(ts, c.id, DEFAULT_CONFIG, g.proposal.new, cur).J;
        const ju = evaluateSetting(ts, c.id, DEFAULT_CONFIG, u.proposal.new, cur).J;
        expect(jg).toBeLessThanOrEqual(ju + 1e-9);
      }
    }
  });
  it('replay completes in under 3 s for all classes', async () => {
    const ts = generateTraining();
    const t = performance.now();
    for (const c of TUNER_CLASSES) await runTuner(ts, c.id, DEFAULT_CONFIG);
    expect(performance.now() - t).toBeLessThan(process.env.CI ? 8000 : 3000); // relaxed on shared CI runners
  });
  it('approval changes the live alarm settings', async () => {
    const ts = generateTraining();
    const r = await runTuner(ts, 'roc', DEFAULT_CONFIG);
    expect(r.proposal).toBeTruthy();
    const sim = new Simulation(DEFAULT_CONFIG, 1);
    sim.setConfig(applyProposal(r.proposal!));
    expect(sim.cfg.alarms.roc.limit).toBe(r.proposal!.new.limit);
    expect(DEFAULT_CONFIG.alarms.roc.limit).toBe(0.8);
  });
});
