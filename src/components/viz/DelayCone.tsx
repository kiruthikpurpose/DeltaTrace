/** Position-time plot. The shaded wedge is the set of alarms allowed to join the reference alarm:
 *  |dt| <= distance / wave speed + tolerance. Alarms inside merge; outside they do not. */
export interface ConePoint {
  km: number;
  t: number;
  label?: string;
}
export function DelayCone({ points, anchor: refIn, c, tol, height = 280, hopKm = 60 }: { points: ConePoint[]; anchor: ConePoint | null; c: number; tol: number; height?: number; hopKm?: number }) {
  const refPt = refIn ?? { km: 0, t: 0 };
  const W = 640;
  const L = 52;
  const R = 16;
  const T = 16;
  const B = 40;
  const TM = 100; // seconds each side
  const X = (t: number) => L + ((t + TM) / (2 * TM)) * (W - L - R);
  const Y = (km: number) => T + (1 - km / 200) * (height - T - B);
  const slope = 1000 / c;
  const half = (km: number) => Math.abs(km - refPt.km) * slope + tol;
  const inside = (p: ConePoint) => !!refIn && Math.abs(p.km - refPt.km) <= hopKm && Math.abs(p.t - refPt.t) <= half(p.km);
  const lo = Math.max(0, refPt.km - hopKm);
  const hi = Math.min(200, refPt.km + hopKm);
  const clamp = (t: number) => Math.max(-TM, Math.min(TM, t));
  const edge: string[] = [];
  const back: string[] = [];
  for (let km = lo; km <= hi; km += 2) {
    edge.push(`${X(clamp(refPt.t + half(km)))},${Y(km)}`);
    back.unshift(`${X(clamp(refPt.t - half(km)))},${Y(km)}`);
  }
  const n = points.filter(inside).length;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={`Allowed-delay wedge around a reference alarm at km ${refPt.km}. ${n} of ${points.length} alarms fall inside and would merge.`}>
      {[0, 50, 100, 150, 200].map((km) => (
        <g key={km}>
          <line x1={L} x2={W - R} y1={Y(km)} y2={Y(km)} stroke="var(--chart-grid)" />
          <text x={L - 8} y={Y(km)} textAnchor="end" dominantBaseline="central" fontSize={11} fill="var(--chart-axis)" fontFamily="var(--mono)">{km}</text>
        </g>
      ))}
      {[-100, -50, 0, 50, 100].map((t) => (
        <g key={t}>
          <line x1={X(t)} x2={X(t)} y1={T} y2={height - B} stroke="var(--chart-grid)" />
          <text x={X(t)} y={height - B + 16} textAnchor="middle" fontSize={11} fill="var(--chart-axis)" fontFamily="var(--mono)">{t > 0 ? `+${t}` : t}</text>
        </g>
      ))}
      <text x={(L + W - R) / 2} y={height - 6} textAnchor="middle" fontSize={11.5} fill="var(--text-muted)">time relative to the reference alarm (s)</text>
      <text transform={`translate(13,${(T + height - B) / 2}) rotate(-90)`} textAnchor="middle" fontSize={11.5} fill="var(--text-muted)">position (km)</text>
      {refIn && (
        <>
          <polygon points={[...edge, ...back].join(' ')} fill="var(--c-group)" opacity={0.14} />
          <polyline points={edge.join(' ')} fill="none" stroke="var(--c-group)" strokeWidth={1.5} />
          <polyline points={[...back].reverse().join(' ')} fill="none" stroke="var(--c-group)" strokeWidth={1.5} />
        </>
      )}
      {points.map((p, i) => {
        const ok = inside(p);
        const x = X(clamp(p.t));
        const y = Y(p.km);
        return (
          <g key={i}>
            {ok || !refIn ? <circle cx={x} cy={y} r={5} fill={refIn ? 'var(--c-group)' : 'var(--text-muted)'} /> : <path d={`M${x - 4.5},${y - 4.5} l9,9 m0,-9 l-9,9`} stroke="var(--bad)" strokeWidth={2} />}
            {p.label && (
              <text x={x + 9} y={y + 4} fontSize={10.5} fill="var(--text)" stroke="var(--bg-elev-1)" strokeWidth={3.5} paintOrder="stroke">{p.label}</text>
            )}
          </g>
        );
      })}
      {refIn && <circle cx={X(refPt.t)} cy={Y(refPt.km)} r={7} fill="var(--bg-elev-1)" stroke="var(--text)" strokeWidth={2} />}
    </svg>
  );
}
