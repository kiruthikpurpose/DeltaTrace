import type { AlarmType, Config, Priority, RawAlarm } from './types';
import { CHANNELS, FT_DEL, FT_IN, FT_OUT, NCH, NOMINAL, Q_NOM } from './topology';

const PRIORITY: Record<number, Priority> = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical' };

interface CondState {
  active: boolean;
  count: number; // consecutive seconds true (for on-delay)
  alarmId: number;
  raises: number[]; // raise times for chatter detection
}
const newCond = (): CondState => ({ active: false, count: 0, alarmId: -1, raises: [] });

/**
 * Baseline ("existing system") alarm logic: naive, per-sensor limits. Deliberately simple
 * so alarm floods occur on real transients.
 */
export class Scada {
  private conds = new Map<string, CondState>();
  private prev10 = new Float64Array(NCH * 3); // last three scan values per channel
  private prevN = 0;
  private flatHist: Float64Array[] = [];
  nextId = 1;
  active = new Map<number, RawAlarm>();

  private cond(key: string): CondState {
    let c = this.conds.get(key);
    if (!c) {
      c = newCond();
      this.conds.set(key, c);
    }
    return c;
  }

  /** Evaluate one condition; returns a new alarm if it was just raised. */
  private evaluate(
    key: string,
    isTrue: boolean,
    clearOk: boolean,
    onDelay: number,
    scan: number,
    mk: () => Omit<RawAlarm, 'id' | 'state' | 'source' | 'trustAtRaise'>,
    t: number,
    out: RawAlarm[],
    trust: number,
  ) {
    const c = this.cond(key);
    if (!c.active) {
      if (isTrue) {
        c.count += scan;
        if (c.count >= onDelay) {
          c.active = true;
          const a: RawAlarm = { ...mk(), id: this.nextId++, state: 'active', source: 'scada', trustAtRaise: trust };
          c.alarmId = a.id;
          c.raises.push(t);
          out.push(a);
          this.active.set(a.id, a);
        }
      } else c.count = 0;
    } else if (clearOk) {
      c.active = false;
      c.count = 0;
      const a = this.active.get(c.alarmId);
      if (a) {
        a.state = 'cleared';
        a.clearedAt = t;
        this.active.delete(a.id);
      }
    }
    // keep raise history short
    while (c.raises.length && c.raises[0] < t - 600) c.raises.shift();
  }

  chattering(): number {
    let n = 0;
    for (const c of this.conds.values()) if (c.raises.length >= 3) n++;
    return n;
  }

  /**
   * One SCADA scan.
   * vals: held latest measured values; age: seconds since last update per channel.
   */
  scan(t: number, vals: Float64Array, age: Float64Array, skew: Float64Array, cfg: Config, trustOf: (ch: number) => number): RawAlarm[] {
    const out: RawAlarm[] = [];
    const A = cfg.alarms;
    const dt = cfg.scanInterval;
    const mk = (ch: number, type: AlarmType, severity: 1 | 2 | 3 | 4, safety: boolean, value: number) => () => ({
      tag: CHANNELS[ch].tag,
      ch,
      node: CHANNELS[ch].node,
      type,
      severity,
      priority: PRIORITY[severity],
      safetyCritical: safety,
      time: t + skew[CHANNELS[ch].node],
      trueTime: t,
      value,
    });

    for (let ch = 0; ch < NCH; ch++) {
      const v = vals[ch];
      const tr = trustOf(ch);
      const stale = age[ch] > 15;
      this.evaluate(`COMM${ch}`, stale, age[ch] < 6, 0, dt, mk(ch, 'COMM', 2, false, age[ch]), t, out, tr);
      if (stale) continue;
      if (ch < 12) {
        const dev = v - NOMINAL[ch];
        // limits
        this.evaluate(`LL${ch}`, dev < -A.ptLowLow.limit, dev > -A.ptLowLow.limit + A.ptLowLow.deadband, A.ptLowLow.onDelay, dt, mk(ch, 'LL', 4, true, v), t, out, tr);
        this.evaluate(`L${ch}`, dev < -A.ptLow.limit, dev > -A.ptLow.limit + A.ptLow.deadband, A.ptLow.onDelay, dt, mk(ch, 'L', 3, false, v), t, out, tr);
        this.evaluate(`H${ch}`, dev > A.ptHigh.limit, dev < A.ptHigh.limit - A.ptHigh.deadband, A.ptHigh.onDelay, dt, mk(ch, 'H', 3, false, v), t, out, tr);
        this.evaluate(`HH${ch}`, dev > A.ptHighHigh.limit, dev < A.ptHighHigh.limit - A.ptHighHigh.deadband, A.ptHighHigh.onDelay, dt, mk(ch, 'HH', 4, true, v), t, out, tr);
        // rate of change over the last 10 s (two scans)
        if (this.prevN >= 2) {
          const roc = Math.abs(v - this.prev10[ch * 3 + 1]);
          this.evaluate(`ROC${ch}`, roc > A.roc.limit, roc < A.roc.limit - A.roc.deadband, A.roc.onDelay, dt, mk(ch, 'ROC', 2, false, v), t, out, tr);
        }
      } else {
        const nom = NOMINAL[ch];
        this.evaluate(`FLOW_LOW${ch}`, v < 0.7 * nom, v > 0.75 * nom, 0, dt, mk(ch, 'FLOWLOW', 3, false, v), t, out, tr);
        this.evaluate(`FLOW_HIGH${ch}`, v > 1.25 * nom, v < 1.2 * nom, 0, dt, mk(ch, 'FLOWHIGH', 3, false, v), t, out, tr);
      }
    }
    // flow deviation: line balance FT-in − FT-del − FT-out, limit as % of nominal line flow
    if (age[FT_IN] <= 15 && age[FT_DEL] <= 15 && age[FT_OUT] <= 15) {
      const dev = vals[FT_IN] - vals[FT_DEL] - vals[FT_OUT];
      const lim = (A.flowDev.limit / 100) * Q_NOM;
      const db = (A.flowDev.deadband / 100) * Q_NOM;
      const trf = Math.min(trustOf(FT_IN), trustOf(FT_OUT));
      this.evaluate('FLOWDEV+', dev > lim, dev < lim - db, A.flowDev.onDelay, dt, mk(FT_OUT, 'FLOWDEV', 4, true, dev), t, out, trf);
      this.evaluate('FLOWDEV-', dev < -lim, dev > -lim + db, A.flowDev.onDelay, dt, mk(FT_OUT, 'FLOWDEV', 3, false, dev), t, out, trf);
    }
    // "no change" diagnostic: value frozen for 120 s
    this.flatHist.push(Float64Array.from(vals));
    if (this.flatHist.length > 24) this.flatHist.shift();
    if (this.flatHist.length === 24) {
      for (let ch = 0; ch < NCH; ch++) {
        if (age[ch] > 15) continue;
        let mn = Infinity;
        let mx = -Infinity;
        for (const h of this.flatHist) {
          if (h[ch] < mn) mn = h[ch];
          if (h[ch] > mx) mx = h[ch];
        }
        const flat = mx - mn < (ch < 12 ? 0.01 : 0.02);
        this.evaluate(`FLAT${ch}`, flat, !flat, 0, dt, mk(ch, 'FLAT', 1, false, vals[ch]), t, out, trustOf(ch));
      }
    }
    // shift history of values
    for (let ch = 0; ch < NCH; ch++) {
      this.prev10[ch * 3 + 2] = this.prev10[ch * 3 + 1];
      this.prev10[ch * 3 + 1] = this.prev10[ch * 3];
      this.prev10[ch * 3] = vals[ch];
    }
    this.prevN++;
    return out;
  }
}
