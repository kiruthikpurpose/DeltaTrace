import { Rng } from './rng';
import type { ProcEvent } from './types';
import { CHANNELS, FT_DEL, FT_IN, FT_OUT, NCH, NODE_KM, NOMINAL, Q_NOM } from './topology';

/** Spatial decay length of transients (km). */
export const LD = 80;
const SUS: Record<ProcEvent['type'], number> = { pumpTrip: 0.4, valveClosure: 0.4, leak: 0.45, batch: 0 };
/** Water-hammer ringing: makes the naive baseline alarm logic re-trigger (documented in README). */
const RING_AMP = 0.9;
const RING_PERIOD = 12;
const RING_DECAY = 40;

export const LEAK_AMP = { small: 1.0, medium: 2.4, large: 4.8 } as const;
export const LEAK_Q = { small: 15, medium: 30, large: 60 } as const;
export const VALVE_AMP = { small: 1.6, medium: 3.5, large: 5 } as const;

/** Normalised transient shape g(τ): fast rise, double-exponential recovery, ringing. */
export function pulse(tau: number, sus: number): number {
  if (tau <= 0) return 0;
  const rise = 1 - Math.exp(-tau / 2);
  const ring = RING_AMP * Math.exp(-tau / RING_DECAY) * Math.sin((2 * Math.PI * tau) / RING_PERIOD);
  return rise * ((1 - sus) * Math.exp(-tau / 45) + sus + ring);
}

/** Pressure deviation (bar) caused by event `e` at position km at time t. */
export function pressureDelta(e: ProcEvent, km: number, t: number, c: number): number {
  if (e.type === 'batch') return 0;
  const d = Math.abs(km - e.km);
  const tau = t - e.t0 - (d * 1000) / c;
  if (tau <= 0) return 0;
  let g = pulse(tau, SUS[e.type]);
  if (t > e.tEnd) g *= Math.exp(-(t - e.tEnd) / 30);
  let A: number;
  if (e.type === 'leak') A = -LEAK_AMP[e.size];
  else if (e.type === 'pumpTrip') A = km >= e.km ? -6 : 3;
  else A = km >= e.km ? -VALVE_AMP[e.size] : VALVE_AMP[e.size];
  return A * Math.exp(-d / LD) * g;
}

/** Flow lag (s): distance / 1.2 m/s, clipped to 90 s so effects are visible in a demo. */
export function flowLag(distKm: number): number {
  return Math.min((distKm * 1000) / 1.2, 90);
}
const ramp = (tau: number, k: number) => (tau <= 0 ? 0 : 1 - Math.exp(-tau / k));

/** Flow deviation (m³/h) at flow meter channel ch. */
export function flowDelta(e: ProcEvent, ch: number, t: number): number {
  const km = CHANNELS[ch].km;
  const nominal = NOMINAL[ch];
  if (e.type === 'batch') {
    if (ch !== e.channel) return 0;
    const tau = t - e.t0;
    if (tau <= 0) return 0;
    const dur = e.tEnd - e.t0;
    const up = ramp(tau, 2);
    const down = tau > dur ? Math.exp(-(tau - dur) / 15) : 1;
    return 0.06 * Q_NOM * up * down; // ≈ +36 m³/h interface spike
  }
  const tau = t - e.t0 - flowLag(Math.abs(km - e.km));
  if (tau <= 0) return 0;
  let f = 1;
  if (t > e.tEnd) f = Math.exp(-(t - e.tEnd) / 60);
  if (e.type === 'leak') {
    if (ch !== FT_OUT) return 0;
    return -LEAK_Q[e.size] * ramp(tau, 15) * f;
  }
  const frac = e.type === 'pumpTrip' ? 0.15 : 0.1;
  return -frac * nominal * ramp(tau, 20) * (0.5 + 0.5 * Math.exp(-tau / 240)) * f;
}

/** Process simulator state: slow thermal drift (OU) per pressure transmitter. */
export class Process {
  private ou = new Float64Array(NCH);
  constructor(private rng: Rng) {}
  stepThermal() {
    for (let i = 0; i < 12; i++) this.ou[i] += -this.ou[i] / 600 + 0.04 * Math.sqrt(2 / 600) * this.rng.gauss();
  }
  /** Noise-free true values for all channels (thermal drift included). */
  sample(t: number, events: ProcEvent[], c: number, out: Float64Array) {
    for (let ch = 0; ch < NCH; ch++) {
      let v = NOMINAL[ch];
      if (ch < 12) {
        v += this.ou[ch];
        const km = NODE_KM[ch];
        for (let k = 0; k < events.length; k++) v += pressureDelta(events[k], km, t, c);
      } else {
        for (let k = 0; k < events.length; k++) v += flowDelta(events[k], ch, t);
      }
      out[ch] = v;
    }
  }
}
export { FT_IN, FT_DEL, FT_OUT };
