import type { Incident, RawAlarm } from '../../engine';
import { NODE_KM } from '../../engine';

/** Position (km) vs time with the expected wavefront (slope = 1/c). On-line alarms corroborate; outliers are ringed. */
export function IncidentTimeline({ incident, alarms, c, tol, height = 260 }: { incident: Incident; alarms: RawAlarm[]; c: number; tol: number; height?: number }) {
  const pts = alarms.filter((a) => a.source === 'scada' && a.type !== 'FLAT');
  if (!pts.length) return null;
  const W = 640;
  const L = 44;
  const R = 14;
  const T = 14;
  const B = 30;
  const tMin = Math.min(...pts.map((a) => a.time)) - 10;
  const tMax = Math.max(...pts.map((a) => a.time)) + 10;
  const X = (t: number) => L + ((t - tMin) / Math.max(1, tMax - tMin)) * (W - L - R);
  const Y = (km: number) => T + (1 - km / 200) * (height - T - B);
  const o = incident.origin;
  const first = [...pts].sort((a, b) => a.time - b.time)[0];
  const km0 = o ? o.km : NODE_KM[first.node];
  const t0 = o ? o.t0 : first.time;
  const wave = (km: number) => t0 + (Math.abs(km - km0) * 1000) / c;
  const wavePath = (dir: 1 | -1) => {
    const out: string[] = [];
    for (let km = km0; dir === 1 ? km <= 200 : km >= 0; km += dir * 2) out.push(`${out.length ? 'L' : 'M'}${X(wave(km)).toFixed(1)},${Y(km).toFixed(1)}`);
    return out.join(' ');
  };
  const ticks = 5;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={`Incident timeline: ${pts.length} alarms by time and position along the pipe, with the expected pressure-wave front`}>
      {[0, 50, 100, 150, 200].map((km) => (
        <g key={km}>
          <line x1={L} x2={W - R} y1={Y(km)} y2={Y(km)} stroke="var(--chart-grid)" />
          <text x={L - 6} y={Y(km)} textAnchor="end" dominantBaseline="central" fontSize={11} fill="var(--chart-axis)" fontFamily="var(--mono)">{km}</text>
        </g>
      ))}
      {Array.from({ length: ticks + 1 }, (_, i) => tMin + ((tMax - tMin) * i) / ticks).map((t, i) => (
        <text key={i} x={X(t)} y={height - 10} textAnchor="middle" fontSize={11} fill="var(--chart-axis)" fontFamily="var(--mono)">{Math.round(t)}s</text>
      ))}
      <text x={10} y={12} fontSize={11} fill="var(--chart-axis)">km</text>
      <path d={wavePath(1)} fill="none" stroke="var(--c-group)" strokeWidth={2} strokeDasharray="6 4" />
      <path d={wavePath(-1)} fill="none" stroke="var(--c-group)" strokeWidth={2} strokeDasharray="6 4" />
      {pts.map((a) => {
        const exp = wave(NODE_KM[a.node]);
        const isFirst = !pts.some((b) => b.node === a.node && (b.time < a.time || (b.time === a.time && b.id < a.id)));
        if (!isFirst) return <circle key={a.id} cx={X(a.time)} cy={Y(NODE_KM[a.node])} r={2.8} fill="var(--text-muted)" opacity={0.5}><title>repeat alarm from the same sensor</title></circle>;
        const on = Math.abs(a.time - exp) <= tol + 5 + 4;
        return (
          <g key={a.id}>
            <circle cx={X(a.time)} cy={Y(NODE_KM[a.node])} r={a.safetyCritical ? 6 : 4.5} fill={on ? 'var(--c-group)' : 'var(--bad)'} opacity={0.85} />
            {!on && <circle cx={X(a.time)} cy={Y(NODE_KM[a.node])} r={9} fill="none" stroke="var(--bad)" strokeWidth={1.5} />}
          </g>
        );
      })}
      {o && <circle cx={X(o.t0)} cy={Y(o.km)} r={7} fill="none" stroke="var(--text)" strokeWidth={2.5} />}
    </svg>
  );
}
