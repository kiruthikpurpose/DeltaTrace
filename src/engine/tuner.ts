import { DEFAULT_CONFIG, cloneConfig } from './config';
import { Simulation } from './simulation';
import type { AlarmCfg, Config, FaultSpec, TunerCandidate, TunerClassId } from './types';
import { FT_DEL, FT_IN, FT_OUT, NCH, NODE_KM, NOMINAL, Q_NOM } from './topology';

export const TUNER_CLASSES: { id: TunerClassId; label: string; unit: string; key: keyof Config['alarms'] }[] = [
  { id: 'ptLow', label: 'PT-low', unit: 'bar', key: 'ptLow' },
  { id: 'ptHigh', label: 'PT-high', unit: 'bar', key: 'ptHigh' },
  { id: 'roc', label: 'Rate-of-change', unit: 'bar/10 s', key: 'roc' },
  { id: 'flowDev', label: 'Flow-deviation', unit: '% of line flow', key: 'flowDev' },
];

const OFFSETS = [-1.0, -0.5, 0, 0.5, 1.0, 1.5, 2.0];
const DEADBANDS = [0.2, 0.3, 0.5, 0.8, 1.2];
const DELAYS = [0, 5, 10, 20, 30];
const SCALE: Record<TunerClassId, number> = { ptLow: 1, ptHigh: 1, roc: 0.4, flowDev: 1 };
export const W = [1, 2, 0.05, 1];

export interface LabelEvent {
  t0: number;
  km: number;
  type: string;
  tEnd: number;
  /** flow-visible (leak) */
  flow: boolean;
}

export interface TrainingSet {
  n: number; // scans
  hours: number;
  meas: Float32Array; // n*NCH
  trust: Float32Array;
  events: LabelEvent[];
  /** every event/fault, for contaminated-sensor accounting */
  faultCount: number;
}

/** Fault/event script used for the 6-hour synthetic training history. */
export function trainingScript(): { at: number; spec: FaultSpec }[] {
  return [
    { at: 1800, spec: { type: 'pumpTrip', node: 4, duration: 600 } },
    { at: 3600, spec: { type: 'valveClosure', node: 5, size: 'medium', duration: 600 } },
    { at: 4200, spec: { type: 'stuck', channel: 6, duration: 900 } },
    { at: 5400, spec: { type: 'leak', km: 87, size: 'medium', duration: 900 } },
    { at: 7200, spec: { type: 'batch', channel: FT_DEL, duration: 90 } },
    { at: 8100, spec: { type: 'comms', channels: [6, 7], duration: 300 } },
    { at: 9000, spec: { type: 'pumpTrip', node: 8, duration: 600 } },
    { at: 10200, spec: { type: 'drift', channel: 10, duration: 1200 } },
    { at: 11400, spec: { type: 'spike', channel: 2, duration: 300 } },
    { at: 12000, spec: { type: 'valveClosure', node: 3, size: 'small', duration: 600 } },
    { at: 13200, spec: { type: 'falseDrop', channel: 9, duration: 300 } },
    { at: 14400, spec: { type: 'leak', km: 150, size: 'small', duration: 900 } },
    { at: 15600, spec: { type: 'pumpTrip', node: 0, duration: 600 } },
    { at: 16800, spec: { type: 'batch', channel: FT_OUT, duration: 90 } },
    { at: 18000, spec: { type: 'valveClosure', node: 9, size: 'medium', duration: 600 } },
    { at: 19800, spec: { type: 'replay', channel: 1, duration: 600 } },
    { at: 2400, spec: { type: 'spike', channel: 5, duration: 420 } },
    { at: 6000, spec: { type: 'falseDrop', channel: 3, duration: 400 } },
    { at: 6900, spec: { type: 'drift', channel: 8, duration: 1500 } },
    { at: 9600, spec: { type: 'falseDrop', channel: 11, duration: 400 } },
    { at: 17400, spec: { type: 'spike', channel: 11, duration: 420 } },
    { at: 20400, spec: { type: 'falseDrop', channel: 8, duration: 400 } },
  ];
}

const cache = new Map<string, TrainingSet>();

/** Generate (and cache) a seeded training history using the lite engine (process + faults + trust). */
export function generateTraining(seed = 777, hours = 6): TrainingSet {
  const key = `${seed}:${hours}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const total = Math.floor(hours * 3600);
  const n = Math.floor(total / 5);
  const sim = new Simulation(DEFAULT_CONFIG, seed, { lite: true });
  const meas = new Float32Array(n * NCH);
  const trust = new Float32Array(n * NCH);
  let idx = 0;
  sim.scanHook = (s) => {
    if (idx >= n) return;
    for (let ch = 0; ch < NCH; ch++) {
      meas[idx * NCH + ch] = s.measured[ch];
      trust[idx * NCH + ch] = s.trust.T[ch];
    }
    idx++;
  };
  const events: LabelEvent[] = [];
  let faultCount = 0;
  for (const s of trainingScript()) {
    if (s.at >= total) continue;
    sim.injectFault({ ...s.spec, delay: s.at });
    if (['pumpTrip', 'valveClosure', 'leak'].includes(s.spec.type)) {
      const km = s.spec.type === 'leak' ? s.spec.km ?? 87 : NODE_KM[s.spec.node ?? 4];
      events.push({ t0: s.at, km, type: s.spec.type, tEnd: s.at + (s.spec.duration ?? 600), flow: s.spec.type === 'leak' });
    } else if (s.spec.type !== 'batch') faultCount++;
  }
  for (let i = 0; i < total; i++) sim.step();
  const ts: TrainingSet = { n: idx, hours, meas, trust, events, faultCount };
  cache.set(key, ts);
  return ts;
}

/** Build a training set from a live simulation's recorded buffer (last ≤2 h). */
export function trainingFromSim(sim: Simulation): TrainingSet {
  const n = Math.min(Math.floor(Math.min(sim.t, 7200) / 5), 1440, sim.scanCount);
  const meas = new Float32Array(n * NCH);
  const trust = new Float32Array(n * NCH);
  const t1 = Math.floor(sim.t / 5) * 5;
  for (let i = 0; i < n; i++) {
    const t = t1 - (n - 1 - i) * 5;
    for (let ch = 0; ch < NCH; ch++) {
      meas[i * NCH + ch] = sim.measAt(ch, Math.max(0, t));
      trust[i * NCH + ch] = sim.trustAt(sim.scanCount - (n - i), ch);
    }
  }
  const t0 = t1 - (n - 1) * 5;
  const events: LabelEvent[] = [];
  for (const e of sim.timeline) {
    if (e.kind !== 'fault' || !e.spec) continue;
    const sp = e.spec;
    if (!['pumpTrip', 'valveClosure', 'leak'].includes(sp.type)) continue;
    const at = e.t + (sp.delay ?? 0) - t0;
    if (at < 0) continue;
    events.push({ t0: at, km: sp.type === 'leak' ? sp.km ?? 87 : NODE_KM[sp.node ?? 4], type: sp.type, tEnd: at + (sp.duration ?? 600), flow: sp.type === 'leak' });
  }
  return { n, hours: (n * 5) / 3600, meas, trust, events, faultCount: 0 };
}

export function concatTraining(sets: TrainingSet[]): TrainingSet {
  const n = sets.reduce((a, s) => a + s.n, 0);
  const meas = new Float32Array(n * NCH);
  const trust = new Float32Array(n * NCH);
  const events: LabelEvent[] = [];
  let off = 0;
  let fc = 0;
  for (const s of sets) {
    meas.set(s.meas.subarray(0, s.n * NCH), off * NCH);
    trust.set(s.trust.subarray(0, s.n * NCH), off * NCH);
    for (const e of s.events) events.push({ ...e, t0: e.t0 + off * 5, tEnd: e.tEnd + off * 5 });
    off += s.n;
    fc += s.faultCount;
  }
  return { n, hours: (n * 5) / 3600, meas, trust, events, faultCount: fc };
}

interface Prepared {
  ts: TrainingSet;
  /** event index at (scan, ch) for PT, −1 none */
  evPT: Int16Array;
  evFlow: Int16Array; // per scan
  nEvents: number;
  flowEvents: number[];
}

function prepare(ts: TrainingSet, c: number): Prepared {
  const evPT = new Int16Array(ts.n * 12).fill(-1);
  const evFlow = new Int16Array(ts.n).fill(-1);
  ts.events.forEach((e, k) => {
    for (let ch = 0; ch < 12; ch++) {
      const d = Math.abs(NODE_KM[ch] - e.km);
      const a = e.t0 + (d * 1000) / c - 10;
      const b = e.t0 + (d * 1000) / c + 120;
      for (let s = Math.max(0, Math.floor(a / 5)); s <= Math.min(ts.n - 1, Math.ceil(b / 5)); s++) evPT[s * 12 + ch] = k;
    }
    if (e.flow) {
      const a = e.t0 + 80;
      const b = Math.min(e.tEnd, e.t0 + 400) + 120;
      for (let s = Math.max(0, Math.floor(a / 5)); s <= Math.min(ts.n - 1, Math.ceil(b / 5)); s++) evFlow[s] = k;
    }
  });
  return { ts, evPT, evFlow, nEvents: ts.events.length, flowEvents: ts.events.map((e, i) => (e.flow ? i : -1)).filter((i) => i >= 0) };
}

interface Metrics {
  alarmsPer10: number;
  peak10: number;
  pctFlood: number;
  falseAlarms: number;
  meanDelay: number;
  detected: Uint8Array;
  total: number;
}

function summarize(counts: Int32Array, n: number, falseCount: number, firstScan: Int32Array, nEv: number, ts: TrainingSet, flowOnly: boolean, total: number): Metrics {
  // rolling 10-min (120 scans) sum
  let run = 0;
  let peak = 0;
  let flood = 0;
  for (let s = 0; s < n; s++) {
    run += counts[s];
    if (s >= 120) run -= counts[s - 120];
    if (run > peak) peak = run;
    if (run >= 10) flood++;
  }
  const windows = Math.max(1, n / 120);
  let dsum = 0;
  let dn = 0;
  const detected = new Uint8Array(nEv);
  for (let k = 0; k < nEv; k++) {
    if (firstScan[k] >= 0) {
      detected[k] = 1;
      dsum += Math.max(0, firstScan[k] * 5 - ts.events[k].t0);
      dn++;
    }
  }
  return { alarmsPer10: total / windows, peak10: peak, pctFlood: (100 * flood) / Math.max(1, n), falseAlarms: falseCount / windows, meanDelay: dn ? dsum / dn : 0, detected, total };
}

/** Replay one candidate over stored data. */
function replay(p: Prepared, cls: TunerClassId, thr: number, db: number, onDelay: number, gate: boolean, tMin: number): Metrics {
  const { ts, evPT, evFlow } = p;
  const n = ts.n;
  const counts = new Int32Array(n);
  const first = new Int32Array(ts.events.length).fill(-1);
  const needScans = Math.ceil(onDelay / 5);
  let total = 0;
  let falseCount = 0;
  const mark = (s: number, ev: number) => {
    counts[s]++;
    total++;
    if (ev < 0) falseCount++;
    else if (first[ev] < 0 || s < first[ev]) first[ev] = s;
  };
  if (cls === 'flowDev') {
    const lim = (thr / 100) * Q_NOM;
    const dbv = (db / 100) * Q_NOM;
    let activeP = false;
    let activeN = false;
    let cp = 0;
    let cn = 0;
    for (let s = 0; s < n; s++) {
      const o = s * NCH;
      if (gate && (ts.trust[o + FT_IN] < tMin || ts.trust[o + FT_DEL] < tMin || ts.trust[o + FT_OUT] < tMin)) {
        activeP = activeN = false;
        cp = cn = 0;
        continue;
      }
      const dev = ts.meas[o + FT_IN] - ts.meas[o + FT_DEL] - ts.meas[o + FT_OUT];
      if (!activeP) {
        if (dev > lim) {
          cp++;
          if (cp > needScans) {
            activeP = true;
            mark(s, evFlow[s]);
          }
        } else cp = 0;
      } else if (dev < lim - dbv) {
        activeP = false;
        cp = 0;
      }
      if (!activeN) {
        if (dev < -lim) {
          cn++;
          if (cn > needScans) {
            activeN = true;
            mark(s, evFlow[s]);
          }
        } else cn = 0;
      } else if (dev > -lim + dbv) {
        activeN = false;
        cn = 0;
      }
    }
    return summarize(counts, n, falseCount, first, ts.events.length, ts, true, total);
  }
  for (let ch = 0; ch < 12; ch++) {
    const nom = NOMINAL[ch];
    let active = false;
    let c = 0;
    for (let s = 0; s < n; s++) {
      const o = s * NCH + ch;
      if (gate && ts.trust[o] < tMin) {
        active = false;
        c = 0;
        continue;
      }
      let cond: boolean;
      let clear: boolean;
      const v = ts.meas[o] - nom;
      if (cls === 'ptLow') {
        cond = v < -thr;
        clear = v > -thr + db;
      } else if (cls === 'ptHigh') {
        cond = v > thr;
        clear = v < thr - db;
      } else {
        if (s < 2) continue;
        const r = Math.abs(ts.meas[o] - ts.meas[o - 2 * NCH]);
        cond = r > thr;
        clear = r < thr - db;
      }
      if (!active) {
        if (cond) {
          c++;
          if (c > needScans) {
            active = true;
            mark(s, evPT[s * 12 + ch]);
          }
        } else c = 0;
      } else if (clear) {
        active = false;
        c = 0;
      }
    }
  }
  return summarize(counts, n, falseCount, first, ts.events.length, ts, false, total);
}

export interface TunerResult {
  cls: TunerClassId;
  gated: boolean;
  candidates: TunerCandidate[];
  current: TunerCandidate;
  recommended: TunerCandidate | null;
  proposal: ChangeProposal | null;
  ms: number;
}
export interface ChangeProposal {
  cls: TunerClassId;
  point: string;
  old: AlarmCfg;
  new: AlarmCfg;
  reason: string;
  evidence: string;
  stats: { alarmsPct: number; falsePct: number; delayDelta: number; missed: number };
}

const objective = (m: Metrics, missed: number) => W[0] * m.alarmsPer10 + W[1] * m.falseAlarms + W[2] * m.meanDelay + W[3] * 1e6 * missed;

function candGrid(cls: TunerClassId, cur: AlarmCfg): { thr: number; db: number; delay: number }[] {
  const out: { thr: number; db: number; delay: number }[] = [];
  for (const o of OFFSETS) for (const db of DEADBANDS) for (const d of DELAYS) out.push({ thr: Math.max(0.2, cur.limit + o * SCALE[cls]), db: cls === 'roc' ? db * 0.6 : db, delay: d });
  return out;
}

/**
 * Trust-gated replay tuner. Replays a grid of (threshold, deadband, on-delay) on stored
 * history (only samples with T ≥ Tmin when gating is on) and recommends the best safe setting.
 */
export async function runTuner(
  ts: TrainingSet,
  cls: TunerClassId,
  cfg: Config,
  opts: { gate?: boolean; onProgress?: (frac: number) => void; yieldEvery?: number } = {},
): Promise<TunerResult> {
  const t0 = performance.now();
  const gate = opts.gate ?? true;
  const cur = cfg.alarms[TUNER_CLASSES.find((c) => c.id === cls)!.key];
  const prep = prepare(ts, cfg.waveSpeed);
  const grid = candGrid(cls, cur);
  const curM = replay(prep, cls, cur.limit, cur.deadband, cur.onDelay, gate, cfg.tMin);
  const curDetected = curM.detected;
  const mkCand = (g: { thr: number; db: number; delay: number }, m: Metrics, isCur: boolean): TunerCandidate => {
    let missed = 0;
    for (let k = 0; k < curDetected.length; k++) if (curDetected[k] && !m.detected[k]) missed++;
    return {
      cls,
      threshold: g.thr,
      deadband: g.db,
      onDelay: g.delay,
      alarmsPer10: m.alarmsPer10,
      peak10: m.peak10,
      pctFlood: m.pctFlood,
      falseAlarms: m.falseAlarms,
      meanDelay: m.meanDelay,
      missed,
      objective: objective(m, missed),
      feasible: false,
      pareto: false,
      isCurrent: isCur,
      isRecommended: false,
    };
  };
  const current = mkCand({ thr: cur.limit, db: cur.deadband, delay: cur.onDelay }, curM, true);
  const candidates: TunerCandidate[] = [];
  const every = opts.yieldEvery ?? 20;
  for (let i = 0; i < grid.length; i++) {
    const g = grid[i];
    const m = replay(prep, cls, g.thr, g.db, g.delay, gate, cfg.tMin);
    const c = mkCand(g, m, false);
    c.feasible = c.missed === 0 && c.meanDelay <= current.meanDelay + 20 && c.alarmsPer10 <= current.alarmsPer10 + 1e-9;
    candidates.push(c);
    if (i % every === every - 1) {
      opts.onProgress?.((i + 1) / grid.length);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  opts.onProgress?.(1);
  // Pareto front over safe candidates (missed = 0): minimise delay and alarm rate
  const safe = candidates.filter((c) => c.missed === 0);
  for (const a of safe) a.pareto = !safe.some((b) => b !== a && b.meanDelay <= a.meanDelay && b.alarmsPer10 <= a.alarmsPer10 && (b.meanDelay < a.meanDelay || b.alarmsPer10 < a.alarmsPer10));
  const feasible = candidates.filter((c) => c.feasible);
  let rec: TunerCandidate | null = null;
  for (const c of feasible) if (!rec || c.objective < rec.objective) rec = c;
  if (rec && rec.objective >= current.objective - 1e-9) rec = null;
  if (rec) rec.isRecommended = true;
  let proposal: ChangeProposal | null = null;
  if (rec) {
    const meta = TUNER_CLASSES.find((c) => c.id === cls)!;
    const pct = (a: number, b: number) => (b > 0 ? (100 * (a - b)) / b : 0);
    const stats = { alarmsPct: pct(rec.alarmsPer10, current.alarmsPer10), falsePct: pct(rec.falseAlarms, current.falseAlarms), delayDelta: rec.meanDelay - current.meanDelay, missed: rec.missed };
    proposal = {
      cls,
      point: meta.label,
      old: { ...cur },
      new: { limit: +rec.threshold.toFixed(2), deadband: +rec.deadband.toFixed(2), onDelay: rec.onDelay },
      reason: `Best safe setting on ${ts.hours.toFixed(0)} h of ${gate ? 'trust-gated' : 'ungated'} history`,
      evidence: `alarms ${stats.alarmsPct.toFixed(0)}%, false alarms ${stats.falsePct.toFixed(0)}%, delay ${stats.delayDelta >= 0 ? '+' : ''}${stats.delayDelta.toFixed(0)} s, missed events ${rec.missed}`,
      stats,
    };
  }
  return { cls, gated: gate, candidates, current, recommended: rec, proposal, ms: performance.now() - t0 };
}

/** Evaluate a specific setting on a (clean = gated) replay, returning its objective. */
export function evaluateSetting(ts: TrainingSet, cls: TunerClassId, cfg: Config, setting: AlarmCfg, baseline: AlarmCfg): { J: number; missed: number; alarmsPer10: number; falseAlarms: number; meanDelay: number } {
  const prep = prepare(ts, cfg.waveSpeed);
  const base = replay(prep, cls, baseline.limit, baseline.deadband, baseline.onDelay, true, cfg.tMin);
  const m = replay(prep, cls, setting.limit, setting.deadband, setting.onDelay, true, cfg.tMin);
  let missed = 0;
  for (let k = 0; k < base.detected.length; k++) if (base.detected[k] && !m.detected[k]) missed++;
  return { J: objective(m, missed), missed, alarmsPer10: m.alarmsPer10, falseAlarms: m.falseAlarms, meanDelay: m.meanDelay };
}

export function applyProposal(cfg: Config, p: ChangeProposal): Partial<Config> {
  const key = TUNER_CLASSES.find((c) => c.id === p.cls)!.key;
  return { alarms: { [key]: { ...p.new } } as any };
}
export function revertSetting(cls: TunerClassId, old: AlarmCfg): Partial<Config> {
  const key = TUNER_CLASSES.find((c) => c.id === cls)!.key;
  return { alarms: { [key]: { ...old } } as any };
}
export function settingOf(cfg: Config, cls: TunerClassId): AlarmCfg {
  return { ...cfg.alarms[TUNER_CLASSES.find((c) => c.id === cls)!.key] };
}
export { cloneConfig };
