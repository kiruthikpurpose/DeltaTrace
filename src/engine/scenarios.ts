import type { Scenario } from './types';

const PT = (n: number) => n;
const FT_DEL = 13;
const FT_OUT = 14;

export const SCENARIOS: Scenario[] = [
  {
    id: 'S0',
    name: 'Normal operation',
    description: 'Steady state with sensor noise only.',
    duration: 1800,
    defaultSeed: 11,
    steps: [],
    truth: [],
  },
  {
    id: 'S1',
    name: 'Pump trip cascade',
    description: 'PS-2 (N4) trips at 5:00; waves propagate both ways and raise L/LL and rate alarms across many nodes.',
    duration: 1800,
    defaultSeed: 12,
    steps: [{ at: 300, spec: { type: 'pumpTrip', node: 4 } }],
    truth: [{ kind: 'process', type: 'pumpTrip', t0: 300, tEnd: 1800, km: 80, channels: [], expected: ['process-event'], node: 4 }],
  },
  {
    id: 'S2',
    name: 'Small leak',
    description: 'A medium leak at km 87 at 6:00: PT-4/PT-5 drop, mass imbalance appears later.',
    duration: 1800,
    defaultSeed: 13,
    steps: [{ at: 360, spec: { type: 'leak', km: 87, size: 'medium' } }],
    truth: [{ kind: 'process', type: 'leak', t0: 360, tEnd: 1800, km: 87, channels: [], expected: ['process-event'] }],
  },
  {
    id: 'S3',
    name: 'Single stuck transmitter',
    description: 'PT-7 sticks at 8:00; a small real transient at 14:00 that PT-7 misses.',
    duration: 1800,
    defaultSeed: 14,
    steps: [
      { at: 480, spec: { type: 'stuck', channel: PT(7) } },
      { at: 840, spec: { type: 'valveClosure', node: 6, size: 'small' } },
    ],
    truth: [
      { kind: 'sensor', type: 'stuck', t0: 480, tEnd: 1800, km: null, channels: [7], expected: ['instrument-fault'] },
      { kind: 'process', type: 'valveClosure', t0: 840, tEnd: 1800, km: 120, channels: [], expected: ['process-event'] },
    ],
  },
  {
    id: 'S4',
    name: 'Spoofed transmitter',
    description: 'PT-3 replays normal data from 5:00; a real valve closure at N5 at 10:00.',
    duration: 1800,
    defaultSeed: 15,
    steps: [
      { at: 300, spec: { type: 'replay', channel: PT(3) } },
      { at: 600, spec: { type: 'valveClosure', node: 5, size: 'medium' } },
    ],
    truth: [
      { kind: 'sensor', type: 'replay', t0: 300, tEnd: 1800, km: null, channels: [3], expected: ['data-integrity'] },
      { kind: 'process', type: 'valveClosure', t0: 600, tEnd: 1800, km: 100, channels: [], expected: ['process-event'] },
    ],
  },
  {
    id: 'S5',
    name: 'False-injection "fake leak"',
    description: 'PT-9 reports a −5 bar drop at 7:00 while its neighbours see nothing.',
    duration: 1800,
    defaultSeed: 16,
    steps: [{ at: 420, spec: { type: 'falseDrop', channel: PT(9) } }],
    truth: [{ kind: 'sensor', type: 'falseDrop', t0: 420, tEnd: 1800, km: null, channels: [9], expected: ['data-integrity', 'instrument-fault'] }],
  },
  {
    id: 'S6',
    name: 'Communications outage',
    description: 'RTUs N6–N8 drop at 6:00 for 4 minutes; a real leak at km 40 at 7:30.',
    duration: 1800,
    defaultSeed: 17,
    steps: [
      { at: 360, spec: { type: 'comms', channels: [6, 7, 8], duration: 240 } },
      { at: 450, spec: { type: 'leak', km: 40, size: 'medium' } },
    ],
    truth: [
      { kind: 'sensor', type: 'comms', t0: 360, tEnd: 600, km: null, channels: [6, 7, 8], expected: ['data-integrity'] },
      { kind: 'process', type: 'leak', t0: 450, tEnd: 1800, km: 40, channels: [], expected: ['process-event'] },
    ],
  },
  {
    id: 'S7',
    name: 'Batch interface',
    description: 'Product interface passes FT-del at 4:00 and FT-out at 14:00: flow-deviation false alarms.',
    duration: 1800,
    defaultSeed: 18,
    steps: [
      { at: 240, spec: { type: 'batch', channel: FT_DEL, duration: 90 } },
      { at: 840, spec: { type: 'batch', channel: FT_OUT, duration: 90 } },
    ],
    truth: [],
  },
  {
    id: 'S8',
    name: 'Mixed stress',
    description: 'Pump trip at PS-3 (4:00), stuck PT-2 (5:00), leak at km 150 (9:00), ±4 s clock skew, batch change (12:00).',
    duration: 1800,
    defaultSeed: 19,
    clockSkew: 4,
    steps: [
      { at: 0, spec: { type: 'skew', amount: 4 } },
      { at: 240, spec: { type: 'pumpTrip', node: 8, duration: 600 } },
      { at: 300, spec: { type: 'stuck', channel: PT(2) } },
      { at: 540, spec: { type: 'leak', km: 150, size: 'medium' } },
      { at: 720, spec: { type: 'batch', channel: FT_DEL, duration: 90 } },
    ],
    truth: [
      { kind: 'process', type: 'pumpTrip', t0: 240, tEnd: 840, km: 160, channels: [], expected: ['process-event'], node: 8 },
      { kind: 'sensor', type: 'stuck', t0: 300, tEnd: 1800, km: null, channels: [2], expected: ['instrument-fault'] },
      { kind: 'process', type: 'leak', t0: 540, tEnd: 1800, km: 150, channels: [], expected: ['process-event'] },
    ],
  },
];

export const scenarioById = (id: string) => SCENARIOS.find((s) => s.id === id)!;
