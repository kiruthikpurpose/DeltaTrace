import { Aggregator, incLabel } from './aggregator';
import { cloneConfig, DEFAULT_CONFIG, mergeConfig } from './config';
import { FaultLayer, FAULT_LABELS } from './faults';
import { computeKpis, emptyKpi } from './metrics';
import { Process } from './process';
import { Rng } from './rng';
import { Scada } from './scada';
import { CHANNELS, NCH, NOISE, NOMINAL, NODES, chTag } from './topology';
import { TrustEngine } from './trust';
import { LogBook, opcTag } from './writeback';
import type {
  ActiveFault,
  Config,
  FaultSpec,
  Incident,
  KpiSet,
  RawAlarm,
  RunResult,
  Scenario,
  Snapshot,
  TrustClass,
  TruthLabel,
  WaveVis,
} from './types';

export const HIST_SECONDS = 7200;
export const TRUST_SCANS = 1440;

export interface SimEvent {
  t: number;
  kind: string;
  text: string;
  ref?: number;
}
export interface TimelineEntry {
  t: number;
  kind: 'fault' | 'cfg' | 'clear' | 'clearAll';
  spec?: FaultSpec;
  patch?: Partial<Config>;
  id?: number;
}

interface Acc {
  n: number;
  sum: number;
  peak: number;
  over: number;
  flood: number;
}
const newAcc = (): Acc => ({ n: 0, sum: 0, peak: 0, over: 0, flood: 0 });
function accKpi(a: Acc, total: number, elapsed: number, stale: number): KpiSet {
  if (a.n === 0) return { ...emptyKpi(), total, staleAlarms: stale };
  return {
    avgPer10: a.sum / a.n,
    peak10: a.peak,
    pctWindowsOver10: (100 * a.over) / a.n,
    pctTimeInFlood: (100 * a.flood) / a.n,
    perHour: (total * 3600) / Math.max(1, elapsed),
    total,
    staleAlarms: stale,
  };
}

export interface SimOptions {
  /** Lite mode: process + faults + trust only (used to generate tuner training histories). */
  lite?: boolean;
}

export class Simulation {
  cfg: Config;
  readonly seed: number;
  rng: Rng;
  t = 0;
  process: Process;
  faults: FaultLayer;
  trust = new TrustEngine();
  scada = new Scada();
  agg: Aggregator;
  book = new LogBook();
  lite: boolean;

  truth = new Float64Array(NCH);
  measured = new Float64Array(NOMINAL);
  lastUpdate = new Float64Array(NCH);
  measBuf = new Float32Array(HIST_SECONDS * NCH);
  trueBuf = new Float32Array(HIST_SECONDS * NCH);
  trustBuf = new Float32Array(TRUST_SCANS * NCH);
  scanCount = 0;

  alarmLog: RawAlarm[] = [];
  generated = 0;
  linked = 0;
  passCount = 0;
  rawTimes: number[] = [];
  private accRaw = newAcc();
  private accOp = newAcc();
  raw10 = 0;
  op10 = 0;
  /** per-scan series of (raw10, op10) for charts */
  series: { t: number; raw: number; op: number }[] = [];
  timeline: TimelineEntry[] = [];
  eventQueue: SimEvent[] = [];
  private prevCls: TrustClass[] = Array(NCH).fill('GOOD');
  private hiddenSet = new Set<number>();
  version = 0;
  private cachedSnap: Snapshot | null = null;
  private cachedVersion = -1;
  /** called after trust update on each scan (used to record training histories) */
  scanHook?: (sim: Simulation) => void;

  constructor(cfg: Config = DEFAULT_CONFIG, seed = 1, opts: SimOptions = {}) {
    this.cfg = cloneConfig(cfg);
    this.seed = seed;
    this.lite = !!opts.lite;
    this.rng = new Rng(seed);
    this.process = new Process(this.rng);
    this.faults = new FaultLayer(this.rng);
    this.agg = new Aggregator({
      audit: (actor, action, reason, ref) => this.book.log(this.t, actor, action, reason, ref),
      wb: (tag, value, kind) => this.book.write(this.t, opcTag(tag), value, kind),
      event: (kind, text, ref) => this.eventQueue.push({ t: this.t, kind, text, ref }),
    });
    this.faults.onStart = (f) => {
      this.book.log(this.t, 'Simulation', 'fault-start', `${f.label} ${this.describe(f)}`);
      this.eventQueue.push({ t: this.t, kind: 'fault', text: `${f.label} ${this.describe(f)} started` });
    };
    this.faults.onEnd = (f) => {
      this.book.log(this.t, 'Simulation', 'fault-end', `${f.label} ended`);
      this.eventQueue.push({ t: this.t, kind: 'fault-end', text: `${f.label} cleared` });
    };
    for (let ch = 0; ch < NCH; ch++) this.measured[ch] = NOMINAL[ch];
  }

  describe(f: ActiveFault): string {
    if (f.kind === 'sensor') return f.channels.map(chTag).join(', ');
    if (f.spec.type === 'leak') return `at km ${f.km}`;
    if (f.spec.type === 'batch') return `at ${f.channels.map(chTag).join(', ')}`;
    return `at ${NODES[f.spec.node ?? 0].name}`;
  }

  /* ------------------------------------------------------------------ control */

  injectFault(spec: FaultSpec): number {
    const f = this.faults.add(spec, this.t);
    this.timeline.push({ t: this.t, kind: 'fault', spec: { ...spec }, id: f.id });
    this.version++;
    return f.id;
  }
  clearFault(id: number) {
    this.faults.clear(id, this.t);
    this.timeline.push({ t: this.t, kind: 'clear', id });
    this.version++;
  }
  clearAllFaults() {
    this.faults.clearAll(this.t);
    this.timeline.push({ t: this.t, kind: 'clearAll' });
    this.version++;
  }
  setConfig(patch: Partial<Config>) {
    const was = this.cfg.engineEnabled;
    this.cfg = mergeConfig(this.cfg, patch);
    this.timeline.push({ t: this.t, kind: 'cfg', patch: JSON.parse(JSON.stringify(patch)) });
    if (patch.engineEnabled !== undefined && patch.engineEnabled !== was) {
      if (!patch.engineEnabled) {
        this.agg.closeAll(this.t, 'fail-open');
        this.book.log(this.t, 'Operator', 'fail-open', 'DeltaTrace engine OFF: raw alarms now pass straight through unchanged');
        this.eventQueue.push({ t: this.t, kind: 'engine', text: 'Fail-open: raw alarms pass through unchanged' });
      } else {
        this.book.log(this.t, 'Operator', 'engine-on', 'DeltaTrace engine ON: grouping resumed');
        this.eventQueue.push({ t: this.t, kind: 'engine', text: 'DeltaTrace engine active again' });
      }
    }
    if (patch.clockSkew !== undefined) this.applySkew();
    this.version++;
  }
  private applySkew() {
    if (this.faults.faults.some((f) => f.spec.type === 'skew' && f.started)) return;
    const a = this.cfg.clockSkew;
    for (let i = 0; i < this.faults.skews.length; i++) this.faults.skews[i] = a ? Math.round(this.rng.range(-a, a) * 10) / 10 : 0;
  }

  /** Schedule a scenario's steps on top of the running simulation. */
  runScenario(sc: Scenario) {
    for (const s of sc.steps) this.injectFault({ ...s.spec, delay: (s.spec.delay ?? 0) + s.at });
  }

  drainEvents(): SimEvent[] {
    const e = this.eventQueue;
    this.eventQueue = [];
    return e;
  }

  /* --------------------------------------------------------------------- step */

  step() {
    const t = this.t;
    const slot = (t % HIST_SECONDS) * NCH;
    this.faults.tick(t, this.measured);
    this.process.stepThermal();
    this.process.sample(t, this.faults.procEvents, this.cfg.waveSpeed, this.truth);
    const measAt = (ch: number, tt: number) => this.measBuf[(tt % HIST_SECONDS) * NCH + ch];
    for (let ch = 0; ch < NCH; ch++) {
      const normal = this.truth[ch] + this.rng.gauss() * NOISE[ch];
      const m = this.faults.measure(ch, t, normal, measAt);
      if (m.updated) {
        this.measured[ch] = m.value;
        this.lastUpdate[ch] = t;
      }
      this.measBuf[slot + ch] = this.measured[ch];
      this.trueBuf[slot + ch] = this.truth[ch];
    }
    if (t % this.cfg.scanInterval === 0) this.scan(t);
    this.t++;
    this.version++;
  }

  private age = new Float64Array(NCH);
  private quality = new Uint8Array(NCH);

  private scan(t: number) {
    const cfg = this.cfg;
    for (let ch = 0; ch < NCH; ch++) {
      this.age[ch] = t - this.lastUpdate[ch];
      this.quality[ch] = this.age[ch] > 60 ? 1 : 0;
    }
    const states = this.trust.update(t, this.measured, this.age, this.quality, NOMINAL, cfg);
    const row = (this.scanCount % TRUST_SCANS) * NCH;
    for (let ch = 0; ch < NCH; ch++) this.trustBuf[row + ch] = states[ch].T;
    this.scanCount++;
    this.scanHook?.(this);

    // derived data-quality flags on class changes
    for (let ch = 0; ch < NCH; ch++) {
      const cls = states[ch].cls;
      if (cls !== this.prevCls[ch]) {
        const worse = cls === 'BAD' || (cls === 'UNCERTAIN' && this.prevCls[ch] === 'GOOD');
        if (!this.lite && cfg.engineEnabled) {
          this.book.write(t, opcTag(`${chTag(ch)}.Quality.Derived`), cls, 'quality');
          this.book.write(t, opcTag(`${chTag(ch)}.Trust`), +states[ch].T.toFixed(2), 'quality');
          this.book.log(t, 'DeltaTrace', 'trust-class', `${chTag(ch)} ${this.prevCls[ch]} → ${cls}${states[ch].likelyFault ? ` (${states[ch].likelyFault})` : ''}`, chTag(ch));
        }
        if (worse) this.eventQueue.push({ t, kind: 'trust', text: `${chTag(ch)} trust dropped to ${cls}${states[ch].likelyFault ? ` · ${states[ch].likelyFault}` : ''}` });
        this.prevCls[ch] = cls;
      }
    }
    if (this.lite) return;

    const alarms = this.scada.scan(t, this.measured, this.age, this.faults.skews, cfg, (ch) => this.trust.T[ch]);
    for (const a of alarms) {
      this.generated++;
      this.rawTimes.push(a.trueTime);
      this.alarmLog.push(a);
    }
    if (this.alarmLog.length > 5000) this.alarmLog.splice(0, this.alarmLog.length - 5000);
    while (this.rawTimes.length > 0 && this.rawTimes[0] < t - HIST_SECONDS) this.rawTimes.shift();

    if (cfg.engineEnabled) {
      // derived replay/spoof alarms
      for (let ch = 0; ch < NCH; ch++) {
        const st = states[ch];
        if (st.likelyFault === 'replay' && st.cls !== 'GOOD') {
          if (!this.agg.hasOpenDq(ch)) {
            const dq: RawAlarm = {
              id: this.scada.nextId++,
              tag: chTag(ch),
              ch,
              node: CHANNELS[ch].node,
              type: 'DQ',
              severity: 3,
              priority: 'High',
              safetyCritical: false,
              time: t,
              trueTime: t,
              value: this.measured[ch],
              state: 'active',
              source: 'deltatrace',
              trustAtRaise: st.T,
            };
            this.agg.ingestDq(dq, t, 'replayed / spoofed data');
          } else this.agg.touchDq(ch, t);
        }
      }
      for (const a of alarms) {
        this.agg.ingest(a, t, cfg, this.trust);
        this.linked++;
      }
      this.agg.tick(t, cfg, this.trust);
      // write-back of incident records
      for (const inc of this.agg.open) this.writeIncident(inc, t);
      this.checkHidden();
    } else {
      for (const a of alarms) {
        a.role = 'passthrough';
        this.passCount++;
        this.agg.passThroughTimes.push(t);
      }
    }
    this.updateKpis(t);
  }

  private lastWritten = new Map<number, string>();
  private writeIncident(inc: Incident, t: number) {
    const key = `${inc.cls}|${inc.alarmIds.length}|${inc.rank}|${inc.origin ? Math.round(inc.origin.km) : ''}`;
    if (this.lastWritten.get(inc.id) === key) return;
    this.lastWritten.set(inc.id, key);
    const base = `DeltaTrace.Incident.${String(inc.id).padStart(3, '0')}`;
    this.book.write(t, opcTag(`${base}.Class`), inc.cls, 'incident');
    this.book.write(t, opcTag(`${base}.Rank`), inc.rank, 'incident');
    if (inc.origin) this.book.write(t, opcTag(`${base}.Origin_km`), +inc.origin.km.toFixed(1), 'incident');
    this.book.write(t, opcTag(`${base}.MemberCount`), inc.alarmIds.length, 'incident');
    if (this.lastWritten.size > 400) {
      const first = this.lastWritten.keys().next().value;
      if (first !== undefined) this.lastWritten.delete(first);
    }
  }

  private checkHidden() {
    for (const adv of this.agg.advisories) {
      const a = this.agg.alarms.get(adv.alarmId);
      if (a?.safetyCritical) this.hiddenSet.add(-adv.id);
    }
    for (const inc of this.agg.open) {
      if (!inc.critical) continue;
      const first = this.agg.alarms.get(inc.headlineIds[0]);
      if (!first?.safetyCritical) this.hiddenSet.add(inc.id);
    }
  }

  private count10(times: number[], t: number): number {
    let n = 0;
    for (let i = times.length - 1; i >= 0 && times[i] > t - 600; i--) n++;
    return n;
  }
  private updateKpis(t: number) {
    this.raw10 = this.count10(this.rawTimes, t);
    this.op10 = this.count10(this.agg.openedTimes, t) + this.count10(this.agg.advisoryTimes, t) + this.count10(this.agg.passThroughTimes, t);
    for (const [a, v] of [
      [this.accRaw, this.raw10],
      [this.accOp, this.op10],
    ] as [Acc, number][]) {
      a.n++;
      a.sum += v;
      a.peak = Math.max(a.peak, v);
      if (v > 10) a.over++;
      if (v >= 10) a.flood++;
    }
    this.series.push({ t, raw: this.raw10, op: this.op10 });
    if (this.series.length > 720) this.series.shift();
  }

  /* ----------------------------------------------------------------- queries */

  get opTotal(): number {
    return this.agg.openedTimes.length + this.agg.advisoryTimes.length + this.agg.passThroughTimes.length;
  }
  criticalHidden(): number {
    return this.hiddenSet.size;
  }
  retainedPct(): number {
    const denom = this.generated - this.passCount;
    return denom <= 0 ? 100 : (100 * this.linked) / denom;
  }
  kpis(): { raw: KpiSet; op: KpiSet } {
    const elapsed = Math.max(1, this.t);
    return { raw: accKpi(this.accRaw, this.generated, elapsed, 0), op: accKpi(this.accOp, this.opTotal, elapsed, 0) };
  }
  chattering(): number {
    return this.scada.chattering();
  }
  /** Read a measured value from the history ring (sim second). */
  measAt(ch: number, t: number): number {
    if (t < 0 || t >= this.t) return NaN;
    if (this.t - t >= HIST_SECONDS) return NaN;
    return this.measBuf[(t % HIST_SECONDS) * NCH + ch];
  }
  trueAt(ch: number, t: number): number {
    if (t < 0 || t >= this.t) return NaN;
    if (this.t - t >= HIST_SECONDS) return NaN;
    return this.trueBuf[(t % HIST_SECONDS) * NCH + ch];
  }
  /** Trust at scan index (0 = oldest retained). */
  trustAt(scan: number, ch: number): number {
    return this.trustBuf[(scan % TRUST_SCANS) * NCH + ch];
  }

  snapshot(): Snapshot {
    if (this.cachedSnap && this.cachedVersion === this.version) return this.cachedSnap;
    const k = this.kpis();
    const waves: WaveVis[] = this.faults.procEvents
      .filter((e) => e.type !== 'batch' && this.t - e.t0 < 400)
      .map((e) => ({ id: e.id, km: e.km, t0: e.t0, type: e.type }));
    const raw = this.generated;
    const snap: Snapshot = {
      t: this.t,
      engineEnabled: this.cfg.engineEnabled,
      values: Float64Array.from(this.truth),
      measured: Float64Array.from(this.measured),
      nominal: NOMINAL,
      trust: this.trust.states.map((s) => ({ ...s, c: { ...s.c } })),
      activeAlarms: [...this.scada.active.values()],
      recentAlarms: this.alarmLog.slice(-120).reverse(),
      openIncidents: this.agg.open.map((i) => ({ ...i })),
      recentClosed: this.agg.archive.slice(0, 30).map((i) => ({ ...i })),
      advisories: this.agg.advisories.filter((a) => a.status === 'open').slice(-40).reverse().map((a) => ({ ...a })),
      faults: this.faults.faults.map((f) => ({ ...f })),
      rawTotal: raw,
      rawActive: this.scada.active.size,
      chattering: this.chattering(),
      raw10: this.raw10,
      raw1m: this.rawTimes.filter((x) => x > this.t - 60).length,
      op10: this.op10,
      opTotal: this.opTotal,
      reduction: raw > 0 ? Math.max(0, 100 * (1 - this.opTotal / raw)) : 0,
      flood: this.raw10 >= 10,
      criticalHidden: this.criticalHidden(),
      retainedPct: this.retainedPct(),
      kpiRaw: k.raw,
      kpiOp: k.op,
      cfg: this.cfg,
      seed: this.seed,
      version: this.version,
      rtuBeat: this.t,
      waves,
    };
    this.cachedSnap = snap;
    this.cachedVersion = this.version;
    return snap;
  }

  /* ---------------------------------------------------------------- headless */

  static runHeadless(scenario: Scenario | null, seed: number, cfg: Config = DEFAULT_CONFIG, opts: { duration?: number; extra?: FaultSpec[] } = {}): RunResult {
    const sim = new Simulation(cfg, seed);
    if (scenario?.clockSkew) sim.setConfig({ clockSkew: scenario.clockSkew });
    if (scenario) sim.runScenario(scenario);
    for (const s of opts.extra ?? []) sim.injectFault(s);
    const dur = opts.duration ?? scenario?.duration ?? 1800;
    for (let i = 0; i < dur; i++) sim.step();
    return sim.result(scenario, dur);
  }

  result(scenario: Scenario | null, dur: number): RunResult {
    const incidents = this.agg.all().sort((a, b) => a.openedAt - b.openedAt);
    const truth: TruthLabel[] = scenario?.truth ?? [];
    const confusion: Record<string, Record<string, number>> = {};
    let correct = 0;
    let matched = 0;
    let falseInc = 0;
    let firstCorrect: number | null = null;
    const originErrs: number[] = [];
    for (const inc of incidents) {
      const tr = this.matchTruth(inc, truth);
      if (!tr) {
        falseInc++;
        continue;
      }
      matched++;
      if (tr.kind === 'process' && tr.km !== null && inc.origin) originErrs.push(Math.abs(inc.origin.km - tr.km));
      const ok = tr.expected.includes(inc.cls);
      if (ok) {
        correct++;
        const lat = inc.openedAt - tr.t0;
        if (firstCorrect === null || lat < firstCorrect) firstCorrect = Math.max(0, lat);
      }
      const exp = tr.expected[0];
      confusion[exp] = confusion[exp] ?? {};
      confusion[exp][inc.cls] = (confusion[exp][inc.cls] ?? 0) + 1;
    }
    const k = this.kpis();
    return {
      scenario: scenario?.id ?? 'custom',
      seed: this.seed,
      duration: dur,
      kpiRaw: computeKpis(this.rawTimes, dur),
      kpiOp: k.op,
      rawTotal: this.generated,
      opTotal: this.opTotal,
      incidents,
      advisoryCount: this.agg.advisories.length,
      alarms: this.alarmLog,
      criticalHidden: this.criticalHidden(),
      falseIncidents: falseInc,
      timeToFirstCorrect: firstCorrect,
      classAccuracy: matched ? (100 * correct) / matched : null,
      confusion,
      retainedPct: this.retainedPct(),
      truth,
      originErr: originErrs.length ? originErrs.reduce((a, b) => a + b, 0) / originErrs.length : null,
    };
  }

  private matchTruth(inc: Incident, truth: TruthLabel[]): TruthLabel | null {
    for (const tr of truth) {
      if (tr.kind !== 'sensor') continue;
      if (inc.openedAt >= tr.t0 - 5 && inc.openedAt <= tr.tEnd + 400 && inc.channels.some((c) => tr.channels.includes(c))) return tr;
    }
    for (const tr of truth) {
      if (tr.kind !== 'process') continue;
      if (inc.openedAt < tr.t0 - 5 || inc.openedAt > tr.t0 + 500) continue;
      const near = inc.channels.some((c) => CHANNELS[c].kind === 'FT' || Math.abs(CHANNELS[c].km - (tr.km ?? 0)) <= 140);
      if (near) return tr;
    }
    return null;
  }
}

export { FAULT_LABELS, incLabel };
