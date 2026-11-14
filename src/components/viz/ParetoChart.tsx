import { useMemo, useRef, useState } from 'react';
import type { TunerCandidate } from '../../engine';

function niceTicks(max: number, n = 5): number[] {
  const raw = max / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(+v.toFixed(6));
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + step);
  return out;
}

/** x = mean detection delay (s), y = alarms per 10 min. */
export function ParetoChart({ candidates, current, height = 340 }: { candidates: TunerCandidate[]; current: TunerCandidate; height?: number; animate?: boolean }) {
  const [hover, setHover] = useState<TunerCandidate | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const W = 720;
  const L = 56;
  const R = 20;
  const T = 14;
  const B = 50;
  const all = useMemo(() => [...candidates, current], [candidates, current]);
  const xs = all.map((c) => c.meanDelay);
  const xTicks = niceTicks(Math.max(...xs) * 1.05 + 1);
  const yTicks = niceTicks(Math.max(...all.map((c) => c.alarmsPer10)) * 1.08 + 0.1);
  const xMax = xTicks[xTicks.length - 1];
  const yMax = yTicks[yTicks.length - 1];
  const X = (v: number) => L + (v / xMax) * (W - L - R);
  const Y = (v: number) => T + (1 - v / yMax) * (height - T - B);
  const safe = candidates.filter((c) => c.missed === 0);
  const rejected = candidates.filter((c) => c.missed > 0);
  const front = candidates.filter((c) => c.pareto).sort((a, b) => a.meanDelay - b.meanDelay || a.alarmsPer10 - b.alarmsPer10);
  let step = '';
  front.forEach((c, i) => {
    step += i === 0 ? `M${X(c.meanDelay)},${Y(c.alarmsPer10)}` : ` H${X(c.meanDelay)} V${Y(c.alarmsPer10)}`;
  });
  const rec = candidates.find((c) => c.isRecommended);
  const onMove = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * W;
    const my = ((e.clientY - r.top) / r.height) * height;
    let best: TunerCandidate | null = null;
    let bd = 22 * 22;
    for (const c of all) {
      const d = (X(c.meanDelay) - mx) ** 2 + (Y(c.alarmsPer10) - my) ** 2;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    setHover(best);
  };
  const star = (cx: number, cy: number, r: number) => Array.from({ length: 10 }, (_, i) => { const a = (Math.PI / 5) * i - Math.PI / 2; const rr = i % 2 ? r * 0.45 : r; return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`; }).join(' ');
  return (
    <div>
      <div style={{ position: 'relative' }}>
        <svg ref={ref} viewBox={`0 0 ${W} ${height}`} width="100%" onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label={`Pareto chart of ${candidates.length} candidate alarm settings, mean detection delay against alarms per 10 minutes. ${rec ? `Recommended setting: ${rec.alarmsPer10.toFixed(2)} alarms per 10 minutes at ${rec.meanDelay.toFixed(0)} seconds delay.` : 'No better safe setting found.'}`}>
          {yTicks.map((v) => (
            <g key={`y${v}`}>
              <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="var(--chart-grid)" />
              <text x={L - 8} y={Y(v)} textAnchor="end" dominantBaseline="central" fontSize={11} fill="var(--chart-axis)" fontFamily="var(--mono)">{v}</text>
            </g>
          ))}
          {xTicks.map((v) => (
            <g key={`x${v}`}>
              <line x1={X(v)} x2={X(v)} y1={T} y2={height - B} stroke="var(--chart-grid)" />
              <text x={X(v)} y={height - B + 16} textAnchor="middle" fontSize={11} fill="var(--chart-axis)" fontFamily="var(--mono)">{v}</text>
            </g>
          ))}
          <line x1={L} x2={W - R} y1={height - B} y2={height - B} stroke="var(--border-strong)" />
          <line x1={L} x2={L} y1={T} y2={height - B} stroke="var(--border-strong)" />
          <text x={(L + W - R) / 2} y={height - 10} textAnchor="middle" fontSize={11.5} fill="var(--text-muted)">Mean detection delay (s)</text>
          <text transform={`translate(14,${(T + height - B) / 2}) rotate(-90)`} textAnchor="middle" fontSize={11.5} fill="var(--text-muted)">Alarms per 10 min</text>
          {rejected.map((c, i) => (
            <path key={`r${i}`} d={`M${X(c.meanDelay) - 3},${Y(c.alarmsPer10) - 3} l6,6 m0,-6 l-6,6`} stroke="var(--text-muted)" strokeWidth={1.1} opacity={0.45} />
          ))}
          {safe.filter((c) => !c.pareto).map((c, i) => (
            <circle key={`s${i}`} cx={X(c.meanDelay)} cy={Y(c.alarmsPer10)} r={3} fill="var(--c-group)" opacity={0.5} />
          ))}
          <path d={step} fill="none" stroke="var(--ok)" strokeWidth={1.8} />
          {front.map((c, i) => (
            <circle key={`f${i}`} cx={X(c.meanDelay)} cy={Y(c.alarmsPer10)} r={3.6} fill="var(--ok)" />
          ))}
          <rect x={X(current.meanDelay) - 6} y={Y(current.alarmsPer10) - 6} width={12} height={12} fill="var(--brand)" stroke="var(--bg-elev-1)" strokeWidth={2} />
          {rec && <polygon points={star(X(rec.meanDelay), Y(rec.alarmsPer10), 11)} fill="var(--ok)" stroke="var(--bg-elev-1)" strokeWidth={1.5} />}
          {hover && <circle cx={X(hover.meanDelay)} cy={Y(hover.alarmsPer10)} r={9} fill="none" stroke="var(--text)" strokeWidth={1.5} />}
        </svg>
        {hover && (
          <div className="chart-tip" style={{ left: `${Math.min(70, (X(hover.meanDelay) / W) * 100)}%`, top: `${(Y(hover.alarmsPer10) / height) * 100}%` }}>
            <b>{hover.isCurrent ? 'Current setting' : hover.isRecommended ? 'Recommended' : hover.missed > 0 ? 'Rejected (misses an event)' : hover.pareto ? 'Pareto front' : 'Candidate'}</b>
            <span>Threshold {hover.threshold.toFixed(2)} · deadband {hover.deadband.toFixed(2)} · on-delay {hover.onDelay} s</span>
            <span>{hover.alarmsPer10.toFixed(2)} alarms/10 min · {hover.falseAlarms.toFixed(2)} false · {hover.meanDelay.toFixed(1)} s delay · {hover.missed} missed</span>
          </div>
        )}
      </div>
      <div className="legend" style={{ marginTop: 8 }}>
        <span className="item"><span className="sw" style={{ background: 'var(--brand)' }} />Current</span>
        <span className="item"><span className="sw" style={{ background: 'var(--ok)', borderRadius: '50%' }} />Pareto front</span>
        <span className="item"><span className="sw" style={{ background: 'var(--c-group)', opacity: 0.5, borderRadius: '50%' }} />Safe candidate</span>
        <span className="item">x  Rejected (would miss an event)</span>
        <span className="item">★ Recommended</span>
      </div>
    </div>
  );
}
