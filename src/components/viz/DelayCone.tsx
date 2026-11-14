/** Position–time plot with the allowed-delay cone from a reference alarm. Alarms inside merge, outside do not. */
export interface ConePoint {
  km: number;
  t: number;
  label?: string;
}
export function DelayCone({ points, anchor: refPt, c, tol, height = 260, hopKm = 60 }: { points: ConePoint[]; anchor: ConePoint; c: number; tol: number; height?: number; hopKm?: number }) {
  const W = 640;
  const L = 44;
  const R = 16;
  const T = 14;
  const B = 30;
  const tMax = 140;
  const X = (t: number) => L + (t / tMax) * (W - L - R);
  const Y = (km: number) => T + (1 - km / 200) * (height - T - B);
  const slope = 1000 / c; // s per km
  const upper = (km: number) => refPt.t + Math.abs(km - refPt.km) * slope + tol;
  const lower = (km: number) => refPt.t - Math.abs(km - refPt.km) * slope - tol;
  const path = (f: (km: number) => number) => {
    const o: string[] = [];
    for (let km = Math.max(0, refPt.km - hopKm); km <= Math.min(200, refPt.km + hopKm); km += 2) o.push(`${o.length ? 'L' : 'M'}${X(Math.max(0, Math.min(tMax, f(km)))).toFixed(1)},${Y(km).toFixed(1)}`);
    return o.join(' ');
  };
  const inside = (p: ConePoint) => Math.abs(p.km - refPt.km) <= hopKm && p.t <= upper(p.km) && p.t >= lower(p.km);
  const area = `${path(upper)} L${X(Math.max(0, Math.min(tMax, lower(Math.min(200, refPt.km + hopKm)))))},${Y(Math.min(200, refPt.km + hopKm))} ${path(lower).replace('M', 'L').split(' ').reverse().join(' ')}`;
  void area;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={`Allowed-delay cone around a reference alarm at km ${refPt.km}. ${points.filter(inside).length} of ${points.length} alarms fall inside and would merge.`}>
      {[0, 50, 100, 150, 200].map((km) => (
        <g key={km}>
          <line x1={L} x2={W - R} y1={Y(km)} y2={Y(km)} stroke="var(--chart-grid)" />
          <text x={L - 6} y={Y(km)} textAnchor="end" dominantBaseline="central" fontSize={11} fill="var(--chart-axis)" fontFamily="var(--mono)">{km}</text>
        </g>
      ))}
      {[0, 20, 40, 60, 80, 100, 120, 140].map((t) => (
        <text key={t} x={X(t)} y={height - 10} textAnchor="middle" fontSize={11} fill="var(--chart-axis)" fontFamily="var(--mono)">{t}s</text>
      ))}
      <path d={path(upper)} fill="none" stroke="var(--c-group)" strokeWidth={2} />
      <path d={path(lower)} fill="none" stroke="var(--c-group)" strokeWidth={2} />
      <polygon
        points={(() => {
          const pts: string[] = [];
          for (let km = Math.max(0, refPt.km - hopKm); km <= Math.min(200, refPt.km + hopKm); km += 2) pts.push(`${X(Math.max(0, Math.min(tMax, upper(km))))},${Y(km)}`);
          for (let km = Math.min(200, refPt.km + hopKm); km >= Math.max(0, refPt.km - hopKm); km -= 2) pts.push(`${X(Math.max(0, Math.min(tMax, lower(km))))},${Y(km)}`);
          return pts.join(' ');
        })()}
        fill="var(--c-group)"
        opacity={0.13}
      />
      {points.map((p, i) => {
        const ok = inside(p);
        return (
          <g key={i}>
            <circle cx={X(p.t)} cy={Y(p.km)} r={6} fill={ok ? 'var(--c-group)' : 'var(--bad)'} />
            {!ok && <path d={`M${X(p.t) - 4},${Y(p.km) - 4} l8,8 m0,-8 l-8,8`} stroke="#fff" strokeWidth={1.6} />}
            {p.label && <text x={X(p.t) + 9} y={Y(p.km) - 8} fontSize={10} fill="var(--text)">{p.label}</text>}
          </g>
        );
      })}
      <circle cx={X(refPt.t)} cy={Y(refPt.km)} r={8} fill="none" stroke="var(--text)" strokeWidth={2.5} />
    </svg>
  );
}
