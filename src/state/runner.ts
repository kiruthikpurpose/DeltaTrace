import {
  Simulation,
  applyProposal,
  revertSetting,
  CHANNELS,
  cloneConfig,
  type ChangeProposal,
  type ChangeRecord,
  type Config,
  type Disposition,
  type FaultSpec,
  type Scenario,
  type TimelineEntry,
  opcTag,
  TUNER_CLASSES,
} from '../engine';
import { useConfigStore } from './configStore';
import { useLogStore } from './logStore';
import { useSimStore } from './simStore';
import { toast, type ToastKind } from './toastStore';

const raf: (f: FrameRequestCallback) => number = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (f) => setTimeout(() => f(performance.now()), 16) as unknown as number;

interface Replay {
  live: Simulation;
  endT: number;
  speedBefore: number;
  captions: { t: number; text: string }[];
  ci: number;
}

/** Owns the live Simulation and drives it with a controlled tick loop; UI reads snapshots at ~10 Hz. */
export class SimulationRunner {
  sim: Simulation;
  running = true;
  speed = 1;
  private acc = 0;
  private last = 0;
  private lastPush = 0;
  private started = false;
  private initialCfg: Config;
  private replay: Replay | null = null;
  private nextChangeId = 1;

  constructor() {
    const { cfg, seed } = useConfigStore.getState();
    this.initialCfg = cloneConfig(cfg);
    this.sim = new Simulation(cfg, seed);
    this.nextChangeId = Math.max(0, ...useLogStore.getState().changeLog.map((c) => c.id)) + 1;
    this.push(true);
  }

  start() {
    if (this.started) return;
    this.started = true;
    const go = () => { this.last = performance.now(); raf(this.loop); };
    if (typeof document !== 'undefined' && document.documentElement.classList.contains('splash-on')) {
      window.addEventListener('deltatrace:splash-done', go, { once: true });
      setTimeout(() => { if (this.last === 0) go(); }, 12000);
    } else go();
  }

  private loop = (ts: number) => {
    const dt = Math.min(0.25, (ts - this.last) / 1000);
    this.last = ts;
    if (this.running) {
      this.acc = Math.min(this.acc + dt * this.speed, 30);
      let n = 0;
      while (this.acc >= 1 && n < 30) {
        this.sim.step();
        this.acc -= 1;
        n++;
        if (this.replay && this.sim.t >= this.replay.endT) {
          this.finishReplay();
          break;
        }
      }
    }
    if (ts - this.lastPush >= 100) {
      this.lastPush = ts;
      this.push();
    }
    raf(this.loop);
  };

  /** Continuous time for smooth animation. */
  visualTime(): number {
    return this.sim.t + (this.running ? this.acc : 0);
  }

  private push(force = false) {
    const events = this.sim.drainEvents();
    for (const e of events) this.handleEvent(e.kind, e.text);
    const st = useSimStore.getState();
    const snap = this.sim.snapshot();
    if (force || st.snap !== snap || st.running !== this.running || st.speed !== this.speed) {
      useSimStore.setState({ snap, running: this.running, speed: this.speed, replaying: !!this.replay, tick: st.tick + 1 });
    }
  }

  private handleEvent(kind: string, text: string) {
    if (this.replay) {
      useSimStore.setState({ caption: text });
    }
    const map: Record<string, ToastKind | null> = {
      fault: 'warn',
      'fault-end': 'ok',
      'incident-open': 'group',
      trust: text.includes('BAD') ? 'bad' : 'trust',
      reclassified: 'group',
      engine: text.includes('Fail-open') ? 'warn' : 'ok',
      advisory: null,
      'incident-close': null,
    };
    const k = map[kind];
    if (k) toast(text, k);
  }

  /* --------------------------------------------------------------- controls */

  play() {
    this.running = true;
    this.push(true);
  }
  pause() {
    this.running = false;
    this.push(true);
  }
  toggle() {
    if (this.running) this.pause();
    else this.play();
  }
  setSpeed(s: number) {
    this.speed = s;
    this.push(true);
  }
  reset(seed?: number) {
    this.replay = null;
    const st = useConfigStore.getState();
    if (seed !== undefined) st.setSeed(seed);
    const cfg = cloneConfig(useConfigStore.getState().cfg);
    this.initialCfg = cloneConfig(cfg);
    this.sim = new Simulation(cfg, seed ?? useConfigStore.getState().seed);
    this.acc = 0;
    useSimStore.setState({ replaying: false, caption: '' });
    this.push(true);
  }
  inject(spec: FaultSpec): number {
    const id = this.sim.injectFault(spec);
    this.push(true);
    return id;
  }
  runScenario(sc: Scenario) {
    if (sc.clockSkew) this.setConfig({ clockSkew: sc.clockSkew });
    this.sim.runScenario(sc);
    toast(`Scenario ${sc.id} “${sc.name}” scripted`, 'info');
    this.push(true);
  }
  clearFault(id: number) {
    this.sim.clearFault(id);
    this.push(true);
  }
  clearAll() {
    this.sim.clearAllFaults();
    this.push(true);
  }
  /** Runtime engine config (also persisted unless it is a transient toggle). */
  setConfig(patch: Partial<Config>) {
    this.sim.setConfig(patch);
    const transient = Object.keys(patch).every((k) => ['engineEnabled', 'clockSkew', 'groupingMode', 'trustGating'].includes(k));
    useConfigStore.getState().patch(patch, !transient);
    this.push(true);
  }
  emergencyReset() {
    this.sim.clearAllFaults();
    if (!this.sim.cfg.engineEnabled || this.sim.cfg.clockSkew) this.setConfig({ engineEnabled: true, clockSkew: 0 });
    this.speed = 1;
    this.running = true;
    toast('Emergency reset: faults cleared, engine active', 'ok');
    this.push(true);
  }

  /* ----------------------------------------------------------- operator ops */

  disposition(incId: number, d: Disposition) {
    useLogStore.getState().setDisposition(incId, d);
    const inc = this.sim.agg.find(incId);
    if (inc) {
      inc.disposition = d;
      inc.version++;
    }
    this.sim.book.log(this.sim.t, 'Operator', 'disposition', `INC-${String(incId).padStart(3, '0')} labelled “${d}”`, `INC-${String(incId).padStart(3, '0')}`);
    this.sim.version++;
    toast(`Incident labelled: ${d.replace('-', ' ')}`, 'ok');
    this.push(true);
  }
  restoreAdvisory(id: number) {
    this.sim.agg.restoreAdvisory(id);
    this.sim.version++;
    this.push(true);
  }

  approve(p: ChangeProposal, persist = true): ChangeRecord {
    const before = { ...p.old };
    this.sim.setConfig(applyProposal(this.sim.cfg, p));
    useConfigStore.getState().patch(applyProposal(this.sim.cfg, p), persist);
    const meta = TUNER_CLASSES.find((c) => c.id === p.cls)!;
    const rec: ChangeRecord = {
      id: this.nextChangeId++,
      t: this.sim.t,
      wall: Date.now(),
      who: 'Operator',
      point: p.point,
      cls: p.cls,
      old: describe(p.old, meta.unit),
      new: describe(p.new, meta.unit),
      evidence: p.evidence,
      status: 'Approved',
      before,
      after: { ...p.new },
    };
    useLogStore.getState().addChange(rec);
    this.writeSetting(p.cls, p.new, `approved MOC-${rec.id}`);
    this.sim.book.log(this.sim.t, 'Operator', 'approve-setting', `MOC-${rec.id}: ${p.point} ${rec.old} → ${rec.new} (${p.evidence}); dry-run write-back`, `MOC-${rec.id}`);
    this.sim.version++;
    toast(`Setting approved and written back: ${p.point}`, 'ok');
    this.push(true);
    return rec;
  }

  revert(rec: ChangeRecord) {
    this.sim.setConfig(revertSetting(rec.cls, rec.before));
    useConfigStore.getState().patch(revertSetting(rec.cls, rec.before));
    useLogStore.getState().markReverted(rec.id);
    this.writeSetting(rec.cls, rec.before, `reverted MOC-${rec.id}`);
    this.sim.book.log(this.sim.t, 'Operator', 'revert-setting', `MOC-${rec.id} reverted: ${rec.point} restored to ${rec.old}`, `MOC-${rec.id}`);
    this.sim.version++;
    toast(`Reverted: ${rec.point} restored`, 'warn');
    this.push(true);
  }

  private writeSetting(cls: string, v: { limit: number; deadband: number; onDelay: number }, why: string) {
    const names: Record<string, string> = { ptLow: 'Low', ptHigh: 'High', roc: 'Roc', flowDev: 'FlowDev' };
    const n = names[cls];
    const chans = cls === 'flowDev' ? [CHANNELS[14]] : CHANNELS.slice(0, 12);
    for (const c of chans) {
      this.sim.book.write(this.sim.t, opcTag(`${c.tag}.AlarmCfg.${n}.Threshold`), v.limit, 'setting');
      this.sim.book.write(this.sim.t, opcTag(`${c.tag}.AlarmCfg.${n}.Deadband`), v.deadband, 'setting');
      this.sim.book.write(this.sim.t, opcTag(`${c.tag}.AlarmCfg.${n}.OnDelay`), v.onDelay, 'setting');
    }
    void why;
  }

  /* --------------------------------------------------------- replay (0.25×) */

  canReplay(): boolean {
    return this.sim.t > 30 && this.sim.timeline.some((e) => e.kind === 'fault');
  }
  startReplay() {
    if (this.replay || !this.canReplay()) return;
    const live = this.sim;
    const endT = live.t;
    const startT = Math.max(0, endT - 300);
    const timeline = live.timeline.slice();
    const re = new Simulation(this.initialCfg, live.seed);
    const apply = (e: TimelineEntry) => {
      if (e.kind === 'fault' && e.spec) re.injectFault({ ...e.spec });
      else if (e.kind === 'clear' && e.id !== undefined) re.clearFault(e.id);
      else if (e.kind === 'clearAll') re.clearAllFaults();
      else if (e.kind === 'cfg' && e.patch) re.setConfig(e.patch);
    };
    let ti = 0;
    for (let t = 0; t < startT; t++) {
      while (ti < timeline.length && timeline[ti].t <= re.t) apply(timeline[ti++]);
      re.step();
    }
    const captions: { t: number; text: string }[] = [];
    for (const e of timeline) {
      if (e.t >= startT && e.kind === 'fault' && e.spec) captions.push({ t: e.t + (e.spec.delay ?? 0), text: `Injected: ${describeFault(e.spec)}` });
    }
    // continue applying remaining entries during replay via a stepping hook
    const origStep = re.step.bind(re);
    re.step = () => {
      while (ti < timeline.length && timeline[ti].t <= re.t) apply(timeline[ti++]);
      origStep();
    };
    re.drainEvents();
    this.replay = { live, endT, speedBefore: this.speed, captions, ci: 0 };
    this.sim = re;
    this.speed = 0.25;
    this.acc = 0;
    useSimStore.setState({ replaying: true, caption: 'Replaying the last 5 minutes at 0.25× …' });
    toast('Replaying last 5 minutes at 0.25×', 'info');
    this.push(true);
  }
  private captionTimer = 0;
  finishReplay() {
    if (!this.replay) return;
    this.sim = this.replay.live;
    this.speed = this.replay.speedBefore;
    this.replay = null;
    this.acc = 0;
    useSimStore.setState({ replaying: false, caption: '' });
    toast('Replay finished — back to live', 'ok');
    this.push(true);
  }
  stopReplay() {
    this.finishReplay();
  }
  /** Caption narration during replay. */
  replayCaption(): string {
    if (!this.replay) return '';
    const r = this.replay;
    while (r.ci < r.captions.length && r.captions[r.ci].t <= this.sim.t) {
      useSimStore.setState({ caption: r.captions[r.ci].text });
      r.ci++;
    }
    return useSimStore.getState().caption;
  }
}

function describe(c: { limit: number; deadband: number; onDelay: number }, unit: string): string {
  return `${c.limit.toFixed(2)} ${unit} / db ${c.deadband.toFixed(2)} / ${c.onDelay}s`;
}
export function describeFault(s: FaultSpec): string {
  const ch = (s.channels ?? (s.channel !== undefined ? [s.channel] : [])).map((c) => CHANNELS[c]?.tag).join(', ');
  switch (s.type) {
    case 'leak':
      return `leak at km ${s.km ?? 87} (${s.size ?? 'medium'})`;
    case 'pumpTrip':
      return `pump trip at node ${s.node ?? 4}`;
    case 'valveClosure':
      return `valve closure at node ${s.node ?? 5}`;
    case 'batch':
      return `batch interface at ${ch || 'FT-del'}`;
    default:
      return `${s.type} on ${ch || 'network'}`;
  }
}

export const runner = new SimulationRunner();
