import type { Config, LikelyFault, TrustClass, TrustState } from './types';
import { CHANNELS, FT_DEL, FT_IN, FT_OUT, NCH, NODE_KM, NOISE, neighbours } from './topology';

const HN = 320; // scan-history ring (≈ 27 min at 5 s)
const THR = 0.35; // bar: deviation considered "moving"
const SIGMA_FLOOR = 0.13;

interface Nbr {
  ch: number;
  km: number;
  w: number;
}

export class TrustEngine {
  T = new Float64Array(NCH).fill(1);
  cls: TrustClass[] = Array(NCH).fill('GOOD');
  private badStreak = new Uint8Array(NCH);
  private dev = new Float32Array(HN * NCH);
  private times = new Float64Array(HN).fill(-1e9);
  n = 0;
  private devStart = new Float64Array(NCH).fill(-1);
  private resBuf: number[][] = Array.from({ length: NCH }, () => []);
  private replayScore = new Float64Array(NCH);
  private lastReplayCheck = -1e9;
  private nbrs: Nbr[][] = [];
  states: TrustState[] = [];
  private flatFlag = new Uint8Array(NCH);
  private resHist: Float32Array = new Float32Array(HN * NCH);

  constructor() {
    for (let ch = 0; ch < NCH; ch++) {
      this.nbrs[ch] =
        ch < 12
          ? neighbours(ch, 2).map((x) => ({ ch: x.node, km: x.km, w: x.w }))
          : [];
      this.states.push({
        ch,
        T: 1,
        Traw: 1,
        cls: 'GOOD',
        likelyFault: null,
        c: { z: 0, residual: 0, predicted: 0, sigma: SIGMA_FLOOR, S: 0, C: 0, M: 0, coherent: false },
      });
    }
  }

  private devAt(ch: number, back: number): number {
    if (back >= this.n) return 0;
    return this.dev[((this.n - 1 - back) % HN) * NCH + ch];
  }
  private timeAt(back: number): number {
    return this.times[(this.n - 1 - back + HN * 4) % HN];
  }
  private sigmaOf(ch: number): number {
    const b = this.resBuf[ch];
    if (b.length < 8) return SIGMA_FLOOR;
    const a = b.map(Math.abs).sort((x, y) => x - y);
    const mad = 1.4826 * a[Math.floor(a.length / 2)];
    return Math.max(SIGMA_FLOOR, 1.5 * mad);
  }

  /** max-|dev| (signed) of channel over last k scans */
  private recentExcursion(ch: number, k: number): number {
    let best = 0;
    const m = Math.min(k, this.n);
    for (let i = 0; i < m; i++) {
      const d = this.devAt(ch, i);
      if (Math.abs(d) > Math.abs(best)) best = d;
    }
    return best;
  }

  /**
   * Update trust for all channels. `vals` = held SCADA values, `age` = seconds since last update,
   * `quality` = RTU quality code (1 = bad), `nominal` = nominal profile.
   */
  update(t: number, vals: Float64Array, age: Float64Array, quality: Uint8Array, nominal: Float64Array, cfg: Config): TrustState[] {
    const row = (this.n % HN) * NCH;
    for (let ch = 0; ch < NCH; ch++) this.dev[row + ch] = vals[ch] - nominal[ch];
    this.times[this.n % HN] = t;
    this.n++;
    const delta = cfg.clockTol + cfg.scanInterval;
    const c = cfg.waveSpeed;

    // deviation start tracking
    for (let ch = 0; ch < 12; ch++) {
      const d = Math.abs(this.devAt(ch, 0));
      if (age[ch] > 15) {
        this.devStart[ch] = -1;
        continue;
      }
      if (d > THR) {
        if (this.devStart[ch] < 0) this.devStart[ch] = t;
      } else if (d < 0.5 * THR) this.devStart[ch] = -1;
    }

    // periodic replay check
    if (t - this.lastReplayCheck >= 30) {
      this.lastReplayCheck = t;
      for (let ch = 0; ch < NCH; ch++) this.replayScore[ch] = this.checkReplay(ch, age[ch]);
    }

    // mass balance (flow meters), uncorroborated only
    const m = vals[FT_IN] - vals[FT_DEL] - vals[FT_OUT];
    let anyPtMoving = false;
    for (let ch = 0; ch < 12; ch++) if (Math.abs(this.recentExcursion(ch, 6)) > THR && this.T[ch] > 0.4) anyPtMoving = true;
    let blamed = -1;
    if (!anyPtMoving && Math.abs(m) > 18) {
      let best = 0;
      for (const ch of [FT_IN, FT_DEL, FT_OUT]) {
        const step = Math.abs(this.devAt(ch, 0) - this.devAt(ch, Math.min(24, this.n - 1)));
        if (step > best) {
          best = step;
          blamed = ch;
        }
      }
      if (best < 12) blamed = -1;
    }
    const M = blamed >= 0 ? Math.min(3, (Math.abs(m) - 18) / 18) : 0;

    for (let ch = 0; ch < NCH; ch++) {
      const st = this.states[ch];
      const sig = NOISE[ch];
      const stale = age[ch] > 15;
      let z = 0;
      let residual = 0;
      let predicted = 0;
      let sigma = SIGMA_FLOOR;
      let coherent = false;
      let regionActive = false;
      const dev = this.devAt(ch, 0);

      if (ch < 12) {
        sigma = this.sigmaOf(ch);
        const selfMoving = Math.abs(dev) > THR;
        let sw = 0;
        let sp = 0;
        let activityNb = 0;
        let nbMin = Infinity;
        let nbMax = -Infinity;
        for (const nb of this.nbrs[ch]) {
          const tau = (nb.km * 1000) / c;
          const tj = this.T[nb.ch];
          if (tj < 0.4 || age[nb.ch] > 15) continue;
          const dj = this.devAt(nb.ch, 0);
          if (dj < nbMin) nbMin = dj;
          if (dj > nbMax) nbMax = dj;
          const k = Math.ceil((tau + delta) / cfg.scanInterval) + 1;
          const ex = this.recentExcursion(nb.ch, k);
          if (Math.abs(ex) > THR) {
            activityNb = Math.max(activityNb, Math.abs(ex));
            if (selfMoving && Math.sign(ex) === Math.sign(dev)) coherent = true;
          }
          // neighbours that began to move less than τ+δ ago have not yet had time to reach us
          if (!selfMoving && this.devStart[nb.ch] >= 0 && t - this.devStart[nb.ch] < tau + delta) continue;
          const w = nb.w * tj;
          sw += w;
          sp += w * this.devAt(nb.ch, 0);
        }
        predicted = sw > 0 ? sp / sw : 0;
        residual = stale ? 0 : dev - predicted;
        // a real transient makes the local field non-uniform: widen σ instead of punishing the sensor
        let act = 0;
        if (selfMoving) act = coherent ? Math.max(Math.abs(dev), activityNb) : 0;
        else act = 0.5 * activityNb;
        // neighbours that disagree among themselves: the local field is non-uniform, prediction is unreliable
        if (nbMax - nbMin > 2 * THR) act = Math.max(act, 0.8 * (nbMax - nbMin));
        const sEff = act > 0 ? Math.max(sigma, act) : sigma;
        z = residual / sEff;
        if (selfMoving && !coherent && this.devStart[ch] >= 0 && t - this.devStart[ch] < 30) z = 0; // grace: neighbours may not have seen it yet
        z = Math.max(-8, Math.min(8, z));
        sigma = sEff;
        regionActive = coherent || activityNb > 0;
      }

      // signal behaviour
      let S = 0;
      let kind: LikelyFault = null;
      if (!stale) {
        const flat = this.isFlat(ch, sig);
        this.flatFlag[ch] = flat ? 1 : 0;
        if (flat) {
          S = Math.max(S, this.neighboursVary(ch) ? 2 : 1.5);
          kind = 'stuck';
        }
        const sp = regionActive ? 0 : this.spikeScore(ch, sig);
        if (sp > 0) {
          S = Math.max(S, sp);
          if (!kind) kind = 'spike';
        }
        if (this.replayScore[ch] > 0) {
          S = Math.max(S, 3);
          kind = 'replay';
        }
      }
      // communication
      let C = 0;
      if (stale || quality[ch]) {
        C = quality[ch] ? 4 : Math.min(4, (age[ch] - 15) / 15);
        kind = 'stale';
      }
      // mass balance applies to flow meters
      const Mc = ch >= 12 && ch === blamed ? M : 0;

      const Traw = Math.exp(-(cfg.lambdaR * z * z + cfg.lambdaS * S + cfg.lambdaC * C + cfg.lambdaM * Mc));
      const prev = this.T[ch];
      let T: number;
      if (Traw < prev) {
        const wNew = coherent ? 0.1 : 0.3; // slower decay when corroborated
        T = wNew * Traw + (1 - wNew) * prev;
      } else T = 0.3 * Traw + 0.7 * prev;

      // hysteresis classes
      let cls = this.cls[ch];
      if (cls === 'BAD') {
        if (T >= 0.55) this.badStreak[ch]++;
        else this.badStreak[ch] = 0;
        if (this.badStreak[ch] >= 3) {
          cls = T >= cfg.goodThreshold ? 'GOOD' : 'UNCERTAIN';
          this.badStreak[ch] = 0;
        }
      } else if (T < cfg.badThreshold) {
        cls = 'BAD';
        this.badStreak[ch] = 0;
      } else cls = T >= cfg.goodThreshold ? 'GOOD' : 'UNCERTAIN';

      // likely-fault inference when not already explained by S/C
      if (!kind && cls !== 'GOOD') {
        if (ch >= 12 && Mc > 0.3) kind = 'inconsistent';
        else if (ch < 12 && Math.abs(z) > 2) {
          const old = this.resHistAt(ch, 12);
          kind = Math.abs(old) > 0.25 * Math.abs(residual) && Math.abs(old) < 0.85 * Math.abs(residual) && Math.sign(old) === Math.sign(residual) ? 'drift' : 'inconsistent';
        } else kind = 'inconsistent';
      }
      if (cls === 'GOOD') kind = null;

      this.resHist[((this.n - 1) % HN) * NCH + ch] = residual;
      // robust sigma only learns from healthy samples
      if (cls === 'GOOD' && !stale && ch < 12 && Math.abs(dev) < THR) {
        const b = this.resBuf[ch];
        b.push(residual);
        if (b.length > 60) b.shift();
      }

      this.T[ch] = T;
      this.cls[ch] = cls;
      st.T = T;
      st.Traw = Traw;
      st.cls = cls;
      st.likelyFault = kind;
      st.c = { z, residual, predicted, sigma, S, C, M: Mc, coherent };
    }
    return this.states;
  }

  private resHistAt(ch: number, back: number): number {
    if (back >= this.n) return 0;
    return this.resHist[((this.n - 1 - back) % HN) * NCH + ch];
  }

  private isFlat(ch: number, sig: number): boolean {
    const k = 12;
    if (this.n < k) return false;
    let mean = 0;
    for (let i = 0; i < k; i++) mean += this.devAt(ch, i);
    mean /= k;
    let v = 0;
    for (let i = 0; i < k; i++) v += (this.devAt(ch, i) - mean) ** 2;
    v /= k;
    return v < (0.15 * sig) ** 2;
  }
  private neighboursVary(ch: number): boolean {
    if (ch >= 12) return false;
    let n = 0;
    for (const nb of this.nbrs[ch]) {
      if (Math.abs(this.recentExcursion(nb.ch, 12)) > THR) n++;
    }
    return n >= 2;
  }
  private spikeScore(ch: number, sig: number): number {
    const k = 12;
    if (this.n < k + 2) return 0;
    let cnt = 0;
    for (let i = 1; i <= k; i++) {
      const prev = this.devAt(ch, i + 1);
      const mid = this.devAt(ch, i);
      const next = this.devAt(ch, i - 1);
      const jump = ch < 12 ? Math.max(6 * sig, 1.5) : 6 * sig; // real spike storms are 5-10 bar; far-field ringing is smaller
      if (Math.abs(mid - prev) > jump && Math.abs(next - prev) < 0.5 * Math.abs(mid - prev)) cnt++;
    }
    return Math.min(3, cnt * 0.75);
  }
  private replayHits = new Uint8Array(NCH);
  /** Replay check on first differences (removes smooth trends that correlate by accident). */
  private checkReplay(ch: number, age: number): number {
    const W = 24;
    if (age > 15 || this.n < W + 30) {
      this.replayHits[ch] = 0;
      return 0;
    }
    const diff = (back: number) => this.devAt(ch, back) - this.devAt(ch, back + 1);
    const x: number[] = [];
    for (let i = 0; i < W; i++) x.push(diff(i));
    const mx = x.reduce((a, b) => a + b, 0) / W;
    let vx = 0;
    for (let i = 0; i < W; i++) vx += (x[i] - mx) ** 2;
    if (vx / W < (0.5 * NOISE[ch]) ** 2) {
      this.replayHits[ch] = 0;
      return 0;
    }
    // a replay is an *exact* copy: high correlation AND (near-)zero normalised error
    // (correlation alone is fooled by periodic ringing, which repeats with a decaying amplitude)
    let sxx = 0;
    for (let i = 0; i < W; i++) sxx += x[i] * x[i];
    let best = 0;
    const maxLag = Math.min(this.n - W - 2, HN - W - 3);
    for (let lag = W; lag <= maxLag; lag++) {
      let err = 0;
      for (let i = 0; i < W; i++) {
        const d = x[i] - diff(i + lag);
        err += d * d;
      }
      const r = 1 - err / sxx;
      if (r > best) best = r;
    }
    if (best > 0.98) this.replayHits[ch] = Math.min(3, this.replayHits[ch] + 1);
    else this.replayHits[ch] = 0;
    return this.replayHits[ch] >= 2 ? 1 : 0;
  }

  /**
   * Trust-weighted fraction of adjacent channels that deviate within the expected
   * delay window around an alarm raised on `ch` at time tAlarm.
   */
  corroboration(ch: number, tAlarm: number, cfg: Config): number {
    const delta = cfg.clockTol + cfg.scanInterval;
    if (ch >= 12) {
      // flow alarm: corroborated by trusted pressure channels moving anywhere on the line
      let k = 0;
      for (let p = 0; p < 12; p++) if (this.T[p] >= 0.4 && Math.abs(this.recentExcursion(p, 36)) > THR) k++;
      return k >= 2 ? 1 : k === 1 ? 0.15 : 0;
    }
    let sw = 0;
    let sd = 0;
    for (const nb of this.nbrs[ch]) {
      const tj = this.T[nb.ch];
      const w = nb.w * Math.max(tj, 0.02);
      sw += w;
      const tau = (nb.km * 1000) / cfg.waveSpeed;
      const lo = tAlarm - tau - delta;
      const hi = tAlarm + tau + delta;
      let dev = false;
      const m = Math.min(this.n, HN - 1);
      for (let i = 0; i < m; i++) {
        const ts = this.timeAt(i);
        if (ts < lo - 1) break;
        if (ts > hi) continue;
        if (Math.abs(this.devAt(nb.ch, i)) > THR) {
          dev = true;
          break;
        }
      }
      if (dev) sd += w;
    }
    return sw > 0 ? sd / sw : 0;
  }

  /** Series for heatmaps: trust row (copied) — kept in the simulation history buffers. */
  reset() {
    this.T.fill(1);
    this.cls.fill('GOOD');
  }

  /** Position used for charts/tooltips. */
  km(ch: number) {
    return CHANNELS[ch].kind === 'PT' ? NODE_KM[ch] : CHANNELS[ch].km;
  }
}
