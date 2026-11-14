import type { IncidentClass, TrustClass } from '../engine';

export const TRUST_COLOR: Record<TrustClass, string> = { GOOD: 'var(--ok)', UNCERTAIN: 'var(--warn)', BAD: 'var(--bad)' };
export const CLASS_COLOR: Record<IncidentClass, string> = {
  'process-event': 'var(--k-process)',
  'instrument-fault': 'var(--k-fault)',
  'data-integrity': 'var(--k-integrity)',
  'needs-review': 'var(--k-review)',
};
export const SEVERITY_COLOR = ['', 'var(--info)', 'var(--warn)', 'var(--bad)', 'var(--bad)'];

/** Trust (0..1) → green/amber/red for canvases. */
export function trustRgb(t: number): [number, number, number] {
  const c = Math.max(0, Math.min(1, t));
  // red (0) → amber (0.55) → green (1)
  const lerp = (a: number, b: number, k: number) => Math.round(a + (b - a) * k);
  const red: [number, number, number] = [239, 68, 68];
  const amber: [number, number, number] = [245, 158, 11];
  const green: [number, number, number] = [34, 197, 94];
  if (c < 0.55) {
    const k = c / 0.55;
    return [lerp(red[0], amber[0], k), lerp(red[1], amber[1], k), lerp(red[2], amber[2], k)];
  }
  const k = (c - 0.55) / 0.45;
  return [lerp(amber[0], green[0], k), lerp(amber[1], green[1], k), lerp(amber[2], green[2], k)];
}

export interface CanvasTheme {
  bg: string;
  grid: string;
  axis: string;
  text: string;
  pipe: string;
  brand: string;
  ok: string;
  warn: string;
  bad: string;
  info: string;
  group: string;
  trust: string;
  tune: string;
  series: string[];
}
export function readTheme(): CanvasTheme {
  const cs = getComputedStyle(document.documentElement);
  const g = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
  return {
    bg: g('--bg-elev-1', '#111a2e'),
    grid: g('--chart-grid', 'rgba(255,255,255,.1)'),
    axis: g('--chart-axis', '#9bacd0'),
    text: g('--text', '#fff'),
    pipe: g('--pipe', '#2a3b63'),
    brand: g('--brand', '#4f6bff'),
    ok: g('--ok', '#22c55e'),
    warn: g('--warn', '#f59e0b'),
    bad: g('--bad', '#ef4444'),
    info: g('--info', '#38bdf8'),
    group: g('--c-group', '#8b5cf6'),
    trust: g('--c-trust', '#14b8a6'),
    tune: g('--c-tune', '#f59e0b'),
    series: [g('--brand', '#4f6bff'), g('--c-trust', '#14b8a6'), g('--c-tune', '#f59e0b'), g('--c-group', '#8b5cf6'), g('--info', '#38bdf8'), g('--bad', '#ef4444')],
  };
}
