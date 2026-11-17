import type { Channel, NodeDef } from './types';

export const NODE_KM = [0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 190, 200];
const KINDS: NodeDef['kind'][] = ['injection', 'valve', 'valve', 'valve', 'pump', 'valve', 'tap', 'valve', 'pump', 'valve', 'valve', 'terminal'];
const NAMES = ['PS-1', 'SV-1', 'SV-2', 'SV-3', 'PS-2', 'SV-4', 'DT-1', 'SV-5', 'PS-3', 'SV-6', 'SV-7', 'TERM'];

export const NODES: NodeDef[] = NODE_KM.map((km, i) => ({ id: i, name: NAMES[i], km, kind: KINDS[i], rtu: `RTU-${i}` }));
export const NCH = 15;
export const FT_IN = 12;
export const FT_DEL = 13;
export const FT_OUT = 14;
export const Q_NOM = 600;
export const Q_DEL = 100;
export const Q_OUT = 500;

export const CHANNELS: Channel[] = [
  ...NODE_KM.map((km, i): Channel => ({ id: i, tag: `PT-${i}`, kind: 'PT', node: i, km })),
  { id: FT_IN, tag: 'FT-in', kind: 'FT', node: 0, km: 0 },
  { id: FT_DEL, tag: 'FT-del', kind: 'FT', node: 6, km: 120 },
  { id: FT_OUT, tag: 'FT-out', kind: 'FT', node: 11, km: 200 },
];

export const chTag = (ch: number) => CHANNELS[ch].tag;

export function alongPipeDistance(i: number, j: number): number {
  return Math.abs(NODE_KM[i] - NODE_KM[j]);
}
export function hops(i: number, j: number): number {
  return Math.abs(i - j);
}
/** Neighbour nodes within `k` hops, excluding the node itself. */
export function neighbours(i: number, k = 2): { node: number; km: number; w: number }[] {
  const out: { node: number; km: number; w: number }[] = [];
  for (let d = -k; d <= k; d++) {
    const j = i + d;
    if (d === 0 || j < 0 || j >= NODE_KM.length) continue;
    const km = alongPipeDistance(i, j);
    out.push({ node: j, km, w: 1 / km });
  }
  return out;
}
/** Pressure-wave travel time (s) between two nodes. */
export function delay(i: number, j: number, c = 1000): number {
  return (alongPipeDistance(i, j) * 1000) / c;
}

/** Nominal pressure profile (bar). Pump stations boost the line back to 55 bar. */
export function nominalPressureAt(km: number): number {
  if (km < 80) return 62 - 0.2 * km;
  if (km < 160) return 55 - 0.2 * (km - 80);
  return 55 - 0.2 * (km - 160);
}
export function nominalValue(ch: number): number {
  if (ch < 12) return nominalPressureAt(NODE_KM[ch]);
  return ch === FT_IN ? Q_NOM : ch === FT_DEL ? Q_DEL : Q_OUT;
}
export const NOMINAL = Float64Array.from({ length: NCH }, (_, i) => nominalValue(i));
/** Sensor noise sigma per channel. */
export const NOISE = Float64Array.from({ length: NCH }, (_, i) => (i < 12 ? 0.08 : 0.005 * nominalValue(i)));

/** Node whose km is nearest. */
export function nearestNode(km: number): number {
  let b = 0;
  for (let i = 0; i < NODE_KM.length; i++) if (Math.abs(NODE_KM[i] - km) < Math.abs(NODE_KM[b] - km)) b = i;
  return b;
}
/** Segment (node index pair) containing km. */
export function segmentOf(km: number): [number, number] {
  for (let i = 0; i < NODE_KM.length - 1; i++) if (km >= NODE_KM[i] && km <= NODE_KM[i + 1]) return [i, i + 1];
  return [0, 1];
}
