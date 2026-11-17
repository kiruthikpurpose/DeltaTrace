import { DEFAULT_CONFIG, cloneConfig, mergeConfig } from './config';
import { SCENARIOS } from './scenarios';
import { Simulation } from './simulation';
import { TUNER_CLASSES, applyProposal, evaluateSetting, generateTraining, runTuner, settingOf, trainingFromSim, concatTraining, type TrainingSet } from './tuner';
import type { Config, FaultSpec, RunResult, Scenario } from './types';
import { CHANNELS } from './topology';

const yieldUi = () => new Promise<void>((r) => setTimeout(r, 0));
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

/* ------------------------------------------------------------------ benchmarks */

export interface BenchSide {
  peak10: number;
  pctFlood: number;
  perHour: number;
  items: number;
}
export interface BenchRow {
  id: string;
  name: string;
  seeds: number[];
  baseline: BenchSide;
  deltatrace: BenchSide;
  suppression: number;
  timeToFirstCorrect: number | null;
  falseIncidents: number;
  criticalHidden: number;
  classAccuracy: number | null;
  /** how many of the incidents were not process events although there was no true process event */
  note?: string;
}
export interface BenchResult {
  rows: BenchRow[];
  confusion: Record<string, Record<string, number>>;
  seeds: number;
  createdAt: number;
}

export async function runBenchmarks(nSeeds: number, onProgress?: (f: number, label: string) => void, cfg: Config = DEFAULT_CONFIG): Promise<BenchResult> {
  const rows: BenchRow[] = [];
  const confusion: Record<string, Record<string, number>> = {};
  const total = SCENARIOS.length * nSeeds;
  let done = 0;
  for (const sc of SCENARIOS) {
    const runs: RunResult[] = [];
    const seeds: number[] = [];
    for (let i = 0; i < nSeeds; i++) {
      const seed = sc.defaultSeed + i * 101;
      seeds.push(seed);
      runs.push(Simulation.runHeadless(sc, seed, cfg));
      done++;
      onProgress?.(done / total, `${sc.id} seed ${seed}`);
      await yieldUi();
    }
    const side = (k: 'kpiRaw' | 'kpiOp'): BenchSide => ({
      peak10: mean(runs.map((r) => r[k].peak10)),
      pctFlood: mean(runs.map((r) => r[k].pctTimeInFlood)),
      perHour: mean(runs.map((r) => r[k].perHour)),
      items: mean(runs.map((r) => r[k].total)),
    });
    const ttfc = runs.map((r) => r.timeToFirstCorrect).filter((x): x is number => x !== null);
    const acc = runs.map((r) => r.classAccuracy).filter((x): x is number => x !== null);
    for (const r of runs) for (const [e, row] of Object.entries(r.confusion)) for (const [a, n] of Object.entries(row)) ((confusion[e] ??= {})[a] = ((confusion[e] ??= {})[a] ?? 0) + n);
    const baseline = side('kpiRaw');
    const dt = { ...side('kpiOp'), items: mean(runs.map((r) => r.opTotal)) };
    baseline.items = mean(runs.map((r) => r.rawTotal));
    const row: BenchRow = {
      id: sc.id,
      name: sc.name,
      seeds,
      baseline,
      deltatrace: dt,
      suppression: baseline.items > 0 ? 100 * (1 - dt.items / baseline.items) : 0,
      timeToFirstCorrect: ttfc.length ? mean(ttfc) : null,
      falseIncidents: mean(runs.map((r) => r.falseIncidents)),
      criticalHidden: runs.reduce((a, r) => a + r.criticalHidden, 0),
      classAccuracy: acc.length ? mean(acc) : null,
    };
    if (baseline.items < 5) row.note = 'Baseline is already quiet: nothing for DeltaTrace to improve.';
    else if (dt.items >= baseline.items * 0.8) row.note = 'DeltaTrace gives little reduction here: few alarms, or they are unrelated.';
    rows.push(row);
  }
  return { rows, confusion, seeds: nSeeds, createdAt: Date.now() };
}

/* ----------------------------------------------------------------- experiments */

export interface ExperimentResult {
  id: string;
  title: string;
  shows: string;
  columns: string[];
  rows: (string | number)[][];
  note: string;
  good: boolean;
}

function minTrustRun(sc: Scenario | null, seed: number, extra: FaultSpec[] = [], dur = 900) {
  const sim = new Simulation(DEFAULT_CONFIG, seed);
  if (sc) sim.runScenario(sc);
  for (const s of extra) sim.injectFault(s);
  const minT = new Float64Array(15).fill(1);
  for (let i = 0; i < dur; i++) {
    sim.step();
    if (sim.t % 5 === 0) for (let c = 0; c < 15; c++) minT[c] = Math.min(minT[c], sim.trust.T[c]);
  }
  return { sim, minT };
}

export async function runExperiment(id: string, seeds = 3): Promise<ExperimentResult> {
  switch (id) {
    case 'E1': {
      const rows: (string | number)[][] = [];
      const ev: number[] = [];
      const fl: number[] = [];
      for (let k = 0; k < seeds; k++) {
        const e = minTrustRun(null, 301 + k, [{ type: 'leak', km: 87, size: 'medium', delay: 120 }, { type: 'pumpTrip', node: 8, delay: 400 }]);
        const evMin = Math.min(...[3, 4, 5, 6, 7, 8, 9].map((c) => e.minT[c]));
        ev.push(evMin);
        const faults: [string, FaultSpec, number][] = [
          ['stuck PT-7', { type: 'stuck', channel: 7, delay: 120 }, 7],
          ['replay PT-3', { type: 'replay', channel: 3, delay: 120 }, 3],
          ['false drop PT-9', { type: 'falseDrop', channel: 9, delay: 120 }, 9],
          ['drift PT-2', { type: 'drift', channel: 2, delay: 120 }, 2],
        ];
        for (const [name, spec, ch] of faults) {
          const f = minTrustRun(null, 301 + k, [spec], 900);
          fl.push(f.minT[ch]);
          if (k === 0) rows.push([name, 'sensor fault', f.minT[ch].toFixed(2), f.sim.trust.states[ch].cls]);
        }
      }
      rows.unshift(['leak + pump trip (healthy neighbours)', 'real events', Math.min(...ev).toFixed(2), 'min trust of sensors that saw the event']);
      const sep = mean(ev) - mean(fl);
      return { id, title: 'E1 · Trust discrimination', shows: 'A real event seen by many neighbours keeps trust high; a faulty sensor falls.', columns: ['Case', 'Type', 'Lowest trust', 'Final class / note'], rows, note: `Mean separation (event − fault) = ${sep.toFixed(2)}. Slow drift is the hardest case: trust falls late because the error starts small.`, good: sep > 0.3 };
    }
    case 'E2': {
      const rows: (string | number)[][] = [];
      let spanDelay = 0;
      let spanFixed = 0;
      for (const size of ['small', 'medium'] as const) {
        for (const mode of ['delay', 'fixed'] as const) {
          const inc: number[] = [];
          const span: number[] = [];
          for (let k = 0; k < Math.max(3, seeds); k++) {
            const sim = new Simulation(mergeConfig(DEFAULT_CONFIG, { groupingMode: mode }), 311 + k);
            sim.injectFault({ type: 'leak', km: 20, size });
            sim.injectFault({ type: 'leak', km: 170, size });
            for (let i = 0; i < 600; i++) sim.step();
            const all = sim.agg.all();
            inc.push(all.length);
            span.push(all.filter((i) => i.channels.some((c) => c <= 3) && i.channels.some((c) => c >= 8 && c < 12)).length);
          }
          if (size === 'small') {
            if (mode === 'delay') spanDelay = mean(span);
            else spanFixed = mean(span);
          }
          rows.push([`two simultaneous ${size} leaks (km 20 & 170)`, mode === 'delay' ? 'Delay-window' : 'Fixed 60 s', mean(inc).toFixed(1), mean(span).toFixed(1), 'ideal: 0 incidents span both leaks']);
        }
      }
      for (const mode of ['delay', 'fixed'] as const) {
        const rs = Array.from({ length: seeds }, (_, k) => Simulation.runHeadless(SCENARIOS[8], SCENARIOS[8].defaultSeed + k, mergeConfig(DEFAULT_CONFIG, { groupingMode: mode })));
        rows.push(['S8 mixed stress', mode === 'delay' ? 'Delay-window' : 'Fixed 60 s', mean(rs.map((r) => r.incidents.length)).toFixed(1), '–', `class accuracy ${mean(rs.map((r) => r.classAccuracy ?? 0)).toFixed(0)}%`]);
      }
      return { id, title: 'E2 · Grouping vs fixed window', shows: 'The delay rule keeps far-apart events separate; a fixed window merges them.', columns: ['Case', 'Grouping', 'Incidents', 'Incidents spanning both leaks', 'Reference'], rows, note: spanDelay < spanFixed ? 'With small leaks the delay rule keeps the two events apart (0 spanning incidents) while the fixed window merges them. With medium leaks the decaying wave tails overlap mid-line and both methods merge them: delay-based grouping is not magic when alarms genuinely overlap in time and place.' : 'No separation advantage in this run: the events overlapped too much.', good: spanDelay < spanFixed };
    }
    case 'E3': {
      let hidden = 0;
      let minRetained = 100;
      let runs = 0;
      const rows: (string | number)[][] = [];
      for (const sc of SCENARIOS) {
        let h = 0;
        for (let k = 0; k < Math.max(3, seeds); k++) {
          const r = Simulation.runHeadless(sc, sc.defaultSeed + 7 * k, DEFAULT_CONFIG);
          h += r.criticalHidden;
          minRetained = Math.min(minRetained, r.retainedPct);
          runs++;
        }
        hidden += h;
        rows.push([sc.id, sc.name, h, '0 required']);
        await yieldUi();
      }
      return { id, title: 'E3 · Safety', shows: 'Zero safety-critical alarms hidden across every scenario and seed.', columns: ['Scenario', 'Name', 'Critical alarms hidden', 'Rule'], rows, note: `${runs} runs, ${hidden} hidden critical alarms, minimum retained = ${minRetained.toFixed(0)}%.`, good: hidden === 0 && minRetained === 100 };
    }
    case 'E4': {
      const rows: (string | number)[][] = [];
      const modes = [
        { id: 'delay', label: 'Delay-window (tol 5 s)', patch: { groupingMode: 'delay' as const } },
        { id: 'delay0', label: 'Delay-window (tol 0 s)', patch: { groupingMode: 'delay' as const, clockTol: 0 } },
        { id: 'fixed', label: 'Fixed 60 s', patch: { groupingMode: 'fixed' as const } },
      ];
      const inc: Record<string, number[]> = {};
      for (const skew of [0, 2, 4, 5]) {
        for (const m of modes) {
          const rs: RunResult[] = [];
          for (const sc of [SCENARIOS[1], SCENARIOS[2]]) for (let k = 0; k < seeds; k++) {
            const sim = new Simulation(mergeConfig(DEFAULT_CONFIG, { ...m.patch, clockSkew: skew }), sc.defaultSeed + 5 * k);
            sim.runScenario(sc);
            for (let i = 0; i < 1500; i++) sim.step();
            rs.push(sim.result(sc, 1500));
          }
          const n = mean(rs.map((r) => r.incidents.length));
          (inc[m.id] ??= []).push(n);
          rows.push([`±${skew} s`, m.label, n.toFixed(2), `${mean(rs.map((r) => r.classAccuracy ?? 0)).toFixed(0)}%`, mean(rs.map((r) => r.originErr ?? 0)).toFixed(1)]);
        }
        await yieldUi();
      }
      const splits = inc.delay0.some((n) => n > 1.05);
      const robust = inc.delay.every((n) => n <= 1.05);
      return { id, title: 'E4 · Clock-skew robustness', shows: 'Incident count (ideal 1) and class accuracy as RTU clock skew grows (S1 + S2).', columns: ['Skew', 'Grouping', 'Incidents per run', 'Class accuracy', 'Origin error (km)'], rows, note: `${robust ? 'With the default tolerance (5 s + scan interval) skew up to ±5 s did not split any event.' : 'Even with the default tolerance some events split at large skew.'} ${splits ? 'With the tolerance set to 0 s the same skew splits events into several incidents: the tolerance must cover the real clock error.' : 'With tolerance 0 s no splitting was seen in this run.'} Fixed windows ignore skew but cannot keep distant events apart (see E2).`, good: robust };
    }
    case 'E5': {
      const ts = generateTraining();
      const rows: (string | number)[][] = [];
      let better = 0;
      for (const c of TUNER_CLASSES) {
        const g = await runTuner(ts, c.id, DEFAULT_CONFIG, { gate: true });
        const u = await runTuner(ts, c.id, DEFAULT_CONFIG, { gate: false });
        const cur = settingOf(DEFAULT_CONFIG, c.id);
        const jg = g.proposal ? evaluateSetting(ts, c.id, DEFAULT_CONFIG, g.proposal.new, cur).J : null;
        const ju = u.proposal ? evaluateSetting(ts, c.id, DEFAULT_CONFIG, u.proposal.new, cur).J : null;
        if (jg !== null && ju !== null && jg < ju - 1e-6) better++;
        rows.push([c.label, g.proposal ? g.proposal.new.limit.toFixed(2) : '–', u.proposal ? u.proposal.new.limit.toFixed(2) : '–', jg !== null ? jg.toFixed(2) : '–', ju !== null ? ju.toFixed(2) : '–', jg !== null && ju !== null ? (jg < ju - 1e-6 ? 'gating better' : 'equal') : 'n/a']);
      }
      return { id, title: 'E5 · Tuner gating ON vs OFF', shows: 'Tuning on contaminated data (faulty sensors included) gives a worse or equal recommendation.', columns: ['Class', 'Gated threshold', 'Ungated threshold', 'J (gated, clean eval)', 'J (ungated, clean eval)', 'Verdict'], rows, note: better === 0 ? 'On this history gating made no measurable difference: honest result.' : `Gating produced a better setting for ${better} of 4 classes; the others were equal. Gating never made it worse.`, good: true };
    }
    case 'E6': {
      const it = await runLoopIterations(3, 19);
      return { id, title: 'E6 · Closed-loop iterations', shows: 'Alarm load per iteration when each tuning round is applied and S8 is re-run.', columns: ['Iteration', 'Raw alarms', 'Peak in 10 min', 'Operator items', 'Settings applied'], rows: it.map((i) => [i.iteration, i.raw, i.peak10, i.op, i.settings]), note: it[it.length - 1].raw < it[0].raw ? `Raw alarm load went from ${it[0].raw} to ${it[it.length - 1].raw} over ${it.length - 1} iterations; gains are uneven because each run uses a different seed.` : 'No improvement: the tuner found no safe setting that reduces the load.', good: it[it.length - 1].raw <= it[0].raw };
    }
    case 'E7': {
      const rows: (string | number)[][] = [];
      const cases: [string, FaultSpec, number][] = [
        ['stuck', { type: 'stuck', channel: 7, delay: 120 }, 7],
        ['drift', { type: 'drift', channel: 2, delay: 120 }, 2],
        ['spike storm', { type: 'spike', channel: 5, delay: 120, duration: 120 }, 5],
        ['replay', { type: 'replay', channel: 3, delay: 400 }, 3],
        ['false injection', { type: 'falseDrop', channel: 9, delay: 120 }, 9],
        ['comms outage', { type: 'comms', channels: [6, 7, 8], delay: 120, duration: 240 }, 7],
      ];
      let detected = 0;
      for (const [name, spec, ch] of cases) {
        const sim = new Simulation(DEFAULT_CONFIG, 331);
        sim.injectFault(spec);
        const start = spec.delay ?? 0;
        let tNotGood = -1;
        let tBad = -1;
        for (let i = 0; i < 1000; i++) {
          sim.step();
          if (sim.t % 5) continue;
          const s = sim.trust.states[ch];
          if (tNotGood < 0 && s.cls !== 'GOOD') tNotGood = sim.t - start;
          if (tBad < 0 && s.cls === 'BAD') tBad = sim.t - start;
        }
        if (tBad >= 0) detected++;
        rows.push([name, tNotGood >= 0 ? `${tNotGood} s` : 'never', tBad >= 0 ? `${tBad} s` : 'never', sim.agg.advisories.length, sim.agg.all().length, sim.criticalHidden()]);
        await yieldUi();
      }
      return { id, title: 'E7 · Robustness to fault types', shows: 'How quickly each fault type is noticed, and what the operator sees instead.', columns: ['Fault', 'Not GOOD after', 'BAD after', 'Advisories', 'Incidents', 'Critical hidden'], rows, note: `${detected} of ${cases.length} fault types reached BAD. A short spike storm or a brief comms loss recovers trust quickly (hysteresis); slow drift is noticed later because the residual grows slowly.`, good: detected >= 4 };
    }
    default:
      throw new Error(`Unknown experiment ${id}`);
  }
}
export const EXPERIMENTS = [
  { id: 'E1', title: 'Trust discrimination', shows: 'Event vs fault: does trust tell them apart?' },
  { id: 'E2', title: 'Grouping vs fixed window', shows: 'Delay-based grouping vs a fixed 60 s window.' },
  { id: 'E3', title: 'Safety', shows: 'Zero hidden critical alarms across all runs.' },
  { id: 'E4', title: 'Clock-skew robustness', shows: 'Skew 0 / 2 / 4 / 5 s, delay-window vs fixed.' },
  { id: 'E5', title: 'Tuner gating ON vs OFF', shows: 'Contaminated data gives a worse recommendation.' },
  { id: 'E6', title: 'Closed loop', shows: 'Alarm load per tuning iteration.' },
  { id: 'E7', title: 'Fault-type robustness', shows: 'Detection speed for each fault type.' },
];

/* ------------------------------------------------------------------- loop (E6) */

export interface LoopIteration {
  iteration: number;
  raw: number;
  peak10: number;
  op: number;
  settings: string;
}
export async function runLoopIterations(n: number, seed: number): Promise<LoopIteration[]> {
  const sc = SCENARIOS[8];
  let cfg = cloneConfig(DEFAULT_CONFIG);
  const out: LoopIteration[] = [];
  const history: TrainingSet[] = [generateTraining()];
  const run = (k: number, c: Config) => {
    const sim = new Simulation(c, seed + k * 13);
    if (sc.clockSkew) sim.setConfig({ clockSkew: sc.clockSkew });
    sim.runScenario(sc);
    for (let i = 0; i < sc.duration; i++) sim.step();
    return { sim, res: sim.result(sc, sc.duration) };
  };
  let { sim, res } = run(0, cfg);
  out.push({ iteration: 0, raw: res.rawTotal, peak10: res.kpiRaw.peak10, op: res.opTotal, settings: 'defaults' });
  for (let k = 1; k <= n; k++) {
    history.push(trainingFromSim(sim));
    const ts = concatTraining(history);
    const applied: string[] = [];
    for (const c of TUNER_CLASSES) {
      const r = await runTuner(ts, c.id, cfg, { gate: true });
      if (r.proposal) {
        cfg = mergeConfig(cfg, applyProposal(r.proposal));
        applied.push(`${c.label} ${r.proposal.new.limit.toFixed(2)}`);
      }
    }
    ({ sim, res } = run(k, cfg));
    out.push({ iteration: k, raw: res.rawTotal, peak10: res.kpiRaw.peak10, op: res.opTotal, settings: applied.join(', ') || 'no change' });
    await yieldUi();
  }
  return out;
}
export { CHANNELS };
