import type { Origin } from './types';

export interface OriginPoint {
  km: number;
  t: number;
  w: number;
}

/**
 * Grouping aid (not a leak locator): grid search x0 in [0,200] km minimising
 * Σ w_i (t_i − t0 − |x_i − x0|/c)² with t0 solved in closed form.
 */
export function estimateOrigin(points: OriginPoint[], c: number): Origin | null {
  const distinct = new Set(points.map((p) => p.km));
  if (points.length < 3 || distinct.size < 3) return null;
  const sw = points.reduce((a, p) => a + p.w, 0);
  if (sw <= 0) return null;
  const costs: number[] = [];
  let best = Infinity;
  let bestX = 0;
  let bestT0 = 0;
  for (let i = 0; i <= 400; i++) {
    const x = i * 0.5;
    let st = 0;
    for (const p of points) st += p.w * (p.t - Math.abs(p.km - x) * 1000 / c);
    const t0 = st / sw;
    let cost = 0;
    for (const p of points) {
      const r = p.t - t0 - (Math.abs(p.km - x) * 1000) / c;
      cost += p.w * r * r;
    }
    costs.push(cost);
    if (cost < best) {
      best = cost;
      bestX = x;
      bestT0 = t0;
    }
  }
  // range: contiguous x around the optimum whose cost is within a 2.5 s timing slack
  const slack = sw * 2.5 * 2.5 * 0.5;
  let lo = bestX;
  let hi = bestX;
  const bi = Math.round(bestX / 0.5);
  for (let i = bi; i >= 0 && costs[i] <= best + slack; i--) lo = i * 0.5;
  for (let i = bi; i <= 400 && costs[i] <= best + slack; i++) hi = i * 0.5;
  const curve: { km: number; cost: number }[] = [];
  const norm = Math.max(1e-9, Math.max(...costs));
  for (let i = 0; i <= 400; i += 4) curve.push({ km: i * 0.5, cost: costs[i] / norm });
  return { km: bestX, lo, hi, t0: bestT0, residual: Math.sqrt(best / sw), curve };
}
