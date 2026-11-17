import type { KpiSet } from './types';

/** Alarm count in the 10-minute window ending at each scan time. */
export function rollingCounts(times: number[], from: number, to: number, step = 5, win = 600): number[] {
  const out: number[] = [];
  let lo = 0;
  let hi = 0;
  const s = [...times].sort((a, b) => a - b);
  for (let t = from; t <= to; t += step) {
    while (hi < s.length && s[hi] <= t) hi++;
    while (lo < hi && s[lo] <= t - win) lo++;
    out.push(hi - lo);
  }
  return out;
}

/** ISA-18.2 / EEMUA-191 style KPIs (bands used as annotations only). */
export function computeKpis(times: number[], duration: number, staleAlarms = 0): KpiSet {
  const counts = rollingCounts(times, 0, duration);
  const n = Math.max(1, counts.length);
  const peak = counts.reduce((a, b) => Math.max(a, b), 0);
  const avg = counts.reduce((a, b) => a + b, 0) / n;
  const over = counts.filter((c) => c > 10).length;
  const flood = counts.filter((c) => c >= 10).length;
  return {
    avgPer10: avg,
    peak10: peak,
    pctWindowsOver10: (100 * over) / n,
    pctTimeInFlood: (100 * flood) / n,
    perHour: (times.length * 3600) / Math.max(1, duration),
    total: times.length,
    staleAlarms,
  };
}

export function peakWindow(times: number[], win = 600): number {
  const s = [...times].sort((a, b) => a - b);
  let best = 0;
  let lo = 0;
  for (let hi = 0; hi < s.length; hi++) {
    while (s[hi] - s[lo] >= win) lo++;
    best = Math.max(best, hi - lo + 1);
  }
  return best;
}

export function emptyKpi(): KpiSet {
  return { avgPer10: 0, peak10: 0, pctWindowsOver10: 0, pctTimeInFlood: 0, perHour: 0, total: 0, staleAlarms: 0 };
}
