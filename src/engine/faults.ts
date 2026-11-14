import { Rng } from './rng';
import type { ActiveFault, FaultSpec, ProcEvent, Size, SensorFaultType } from './types';
import { NCH, NODES, nearestNode, FT_DEL } from './topology';

export const SENSOR_FAULTS: SensorFaultType[] = ['stuck', 'drift', 'spike', 'replay', 'falseDrop', 'comms', 'skew'];
export const isSensorFault = (t: string) => (SENSOR_FAULTS as string[]).includes(t);

export const FAULT_LABELS: Record<string, string> = {
  stuck: 'Stuck transmitter',
  drift: 'Drift',
  spike: 'Spike storm',
  replay: 'Replay / spoof',
  falseDrop: 'False injection (fake leak)',
  comms: 'Communications outage',
  skew: 'Clock skew',
  pumpTrip: 'Pump trip',
  valveClosure: 'Valve closure',
  leak: 'Leak',
  batch: 'Batch interface',
};

export interface Measure {
  value: number;
  updated: boolean;
}

interface PerChannel {
  stuckValue: number;
  driftStart: number;
  driftTarget: number;
  replayStart: number;
  replayLoop: number;
  dropStart: number;
}

/** Sensor fault / attack layer: turns normal measured values into faulty ones. */
export class FaultLayer {
  faults: ActiveFault[] = [];
  private nextId = 1;
  private pc: PerChannel[] = Array.from({ length: NCH }, () => ({ stuckValue: 0, driftStart: 0, driftTarget: 0, replayStart: 0, replayLoop: 300, dropStart: 0 }));
  stuck = new Uint8Array(NCH);
  drift = new Uint8Array(NCH);
  spike = new Uint8Array(NCH);
  replay = new Uint8Array(NCH);
  falseDrop = new Uint8Array(NCH);
  comms = new Uint8Array(NCH);
  skews = new Float64Array(NODES.length);
  procEvents: ProcEvent[] = [];
  private nextEventId = 1;
  onStart?: (f: ActiveFault) => void;
  onEnd?: (f: ActiveFault) => void;

  constructor(private rng: Rng) {}

  add(spec: FaultSpec, now: number): ActiveFault {
    const startAt = now + (spec.delay ?? 0);
    const dur = spec.duration ?? (spec.type === 'batch' ? 75 : undefined);
    const endAt = dur !== undefined ? startAt + dur : Infinity;
    const isSensor = isSensorFault(spec.type);
    let channels = spec.channels ?? (spec.channel !== undefined ? [spec.channel] : []);
    const size: Size = spec.size ?? 'medium';
    let km: number | null = null;
    if (!isSensor) {
      if (spec.type === 'leak') km = spec.km ?? 87;
      else if (spec.type === 'batch') {
        km = null;
        channels = [spec.channel ?? FT_DEL];
      } else {
        const node = spec.node ?? (spec.type === 'pumpTrip' ? 4 : 5);
        km = NODES[node].km;
      }
    }
    const f: ActiveFault = {
      id: this.nextId++,
      spec,
      kind: isSensor ? 'sensor' : 'process',
      startAt,
      endAt,
      started: false,
      label: spec.label ?? FAULT_LABELS[spec.type],
      channels,
      km,
      size,
    };
    this.faults.push(f);
    return f;
  }

  clear(id: number, now: number) {
    const f = this.faults.find((x) => x.id === id);
    if (!f) return;
    if (!f.started) {
      this.faults = this.faults.filter((x) => x !== f);
      return;
    }
    this.end(f, now);
  }
  clearAll(now: number) {
    for (const f of [...this.faults]) this.clear(f.id, now);
  }

  private end(f: ActiveFault, now: number) {
    f.endAt = Math.min(f.endAt, now);
    if (f.kind === 'sensor') this.setFlags(f, 0);
    else {
      const ev = this.procEvents.find((e) => e.id === (f as any)._eventId);
      if (ev) ev.tEnd = Math.min(ev.tEnd, now);
    }
    this.onEnd?.(f);
    this.faults = this.faults.filter((x) => x !== f);
  }

  private setFlags(f: ActiveFault, v: number) {
    const arr =
      f.spec.type === 'stuck' ? this.stuck : f.spec.type === 'drift' ? this.drift : f.spec.type === 'spike' ? this.spike : f.spec.type === 'replay' ? this.replay : f.spec.type === 'falseDrop' ? this.falseDrop : f.spec.type === 'comms' ? this.comms : null;
    if (arr) for (const ch of f.channels) arr[ch] = v;
    if (f.spec.type === 'skew') {
      if (v) {
        const a = f.spec.amount ?? 4;
        for (let i = 0; i < this.skews.length; i++) this.skews[i] = Math.round(this.rng.range(-a, a) * 10) / 10;
      } else this.skews.fill(0);
    }
  }

  /** Called every sim second before measurement. */
  tick(t: number, lastMeasured: Float64Array) {
    for (const f of [...this.faults]) {
      if (!f.started && t >= f.startAt) {
        f.started = true;
        if (f.kind === 'process') {
          const ev: ProcEvent = {
            id: this.nextEventId++,
            type: f.spec.type as ProcEvent['type'],
            t0: f.startAt,
            tEnd: f.endAt,
            node: f.spec.node ?? (f.km !== null ? nearestNode(f.km) : 0),
            km: f.km ?? 0,
            size: f.size,
            channel: f.channels[0] ?? FT_DEL,
          };
          if (ev.type === 'batch' && f.spec.duration === undefined) ev.tEnd = ev.t0 + 75;
          (f as any)._eventId = ev.id;
          this.procEvents.push(ev);
        } else {
          for (const ch of f.channels) {
            const p = this.pc[ch];
            p.stuckValue = lastMeasured[ch];
            p.driftStart = t;
            p.driftTarget = (this.rng.chance(0.5) ? 1 : -1) * 3;
            p.dropStart = t;
            p.replayLoop = Math.max(60, Math.min(300, Math.floor(t / 5) * 5));
            p.replayStart = t;
          }
          this.setFlags(f, 1);
        }
        this.onStart?.(f);
      }
      if (f.started && t >= f.endAt && f.endAt !== Infinity) this.end(f, t);
    }
    if (this.procEvents.length > 0 && t % 60 === 0) {
      this.procEvents = this.procEvents.filter((e) => t < e.tEnd + 600);
    }
  }

  /** Apply faults to a normally measured value. */
  measure(ch: number, t: number, normal: number, measAt: (ch: number, t: number) => number): Measure {
    if (this.comms[ch]) return { value: normal, updated: false };
    const p = this.pc[ch];
    let v = normal;
    if (this.stuck[ch]) v = p.stuckValue + this.rng.range(-0.001, 0.001);
    else if (this.replay[ch]) {
      const idx = p.replayStart - p.replayLoop + ((t - p.replayStart) % p.replayLoop);
      v = measAt(ch, Math.max(0, idx));
    } else if (this.falseDrop[ch]) {
      const r = Math.min(1, (t - p.dropStart) / 2);
      v = normal - 5 * r;
    } else {
      if (this.drift[ch]) {
        const r = Math.min(1, (t - p.driftStart) / 600);
        v = normal + p.driftTarget * r;
      }
      if (this.spike[ch] && this.rng.chance(0.35)) v = normal + (this.rng.chance(0.5) ? 1 : -1) * this.rng.range(5, 10);
    }
    return { value: v, updated: true };
  }
}
