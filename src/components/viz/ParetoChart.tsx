import { useState } from 'react';
import type { TunerCandidate } from '../../engine';

/** x = mean detection delay (s), y = alarms per 10 min. */
export function ParetoChart({ candidates, current, height = 340, animate = true }: { candidates: TunerCandidate[]; current: TunerCandidate; height?: number; animate?: boolean }) {
  const [hover, setHover] = useState<TunerCandidate | null>(null);
  const W = 700;
  const L = 52;
  const R = 16;
  const T = 16;
  const B = 44;
  const all = [...candidates, current];
  const xs = all.map((c) => c.meanDelay);
  const ys = all.map((c) => c.alarmsPer10);
  const xMin = Math.max(0, Math.min(...xs) - 3);
  const xMax = Math.max(...xs) + 3;
  const yMax = Math.max(...ys) * 1.1 + 0.1;
  const X = (v: number) => L + ((v - xMin) / Math.max(1, xMax - xMin)) * (W - L - R);
  const Y = (v: number) => T + (1 - v / yMax) * (height - T - B);
  const front = candidates.filter((c) => c.pareto).sort((a, b) => a.meanDelay - b.meanDelay || a.alarmsPer10 - b.alarmsPer10);
  let step = '';
  front.forEach((c, i) => {
    step += i === 0 ? `M${X(c.meanDelay)},${Y(c.alarmsPer10)}` : ` H${X(c.meanDelay)} V${Y(c.alarmsPer10)}`;
  });
  const rec = candidates.find((c) => c.isRecommended);
  const star = (cx: number, cy: number, r: number) => Array.from({ length: 10 }, (_, i) => { const a = (Math.PI / 5) * i - Math.PI / 2; const rr = i % 2 ? r * 0.45 : r; return `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`; }).join(' ');
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={`Pareto chart of ${candidates.length} candidate alarm settings: mean detection delay versus alarms per 10 minutes. ${rec ? 'A recommended setting is marked with a star.' : 'No better safe setting found.'}`}>
        {Array.from({ length: 5 }, (_, i) => (yMax * i) / 4).map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="var(--chart-grid)" />
            <text x={L - 6} y={Y(v)} textAnchor="end" dominantBaseline="central" fontSize={11} fill="var(--chart-axis)" fontFamily="var(--mono)">{v.toFixed(1)}</text>
          </g>
        ))}
        {Array.from({ length: 6 }, (_, i) => xMin + ((xMax - xMin) * i) / 5).map((v) => (
          <text key={v} x={X(v)} y={height - 24} textAnchor="middle" fontSize={11} fill="var(--chart-axis)" fontFamily="var(--mono)">{v.toFixed(0)}</text>
        ))}
        <text x={(L + W - R) / 2} y={height - 6} textAnchor="middle" fontSize={12} fill="var(--text-muted)">mean detection delay (s)</text>
        <text transform={`translate(14,${(T + height - B) / 2}) rotate(-90)`} textAnchor="middle" fontSize={12} fill="var(--text-muted)">alarms per 10 min</text>
        {candidates.map((c, i) =>
          c.missed > 0 ? (
            <path key={i} d={`M${X(c.meanDelay) - 3.5},${Y(c.alarmsPer10) - 3.5} l7,7 m0,-7 l-7,7`} stroke="var(--text-muted)" strokeWidth={1.4} opacity={0.6} onMouseEnter={() => setHover(c)} onMouseLeave={() => setHover(null)} />
          ) : (
            <circle key={i} cx={X(c.meanDelay)} cy={Y(c.alarmsPer10)} r={c.pareto ? 4.5 : 3.2} fill={c.pareto ? 'var(--ok)' : 'var(--info)'} opacity={c.pareto ? 1 : 0.45} onMouseEnter={() => setHover(c)} onMouseLeave={() => setHover(null)} style={animate ? { animation: `fade-in 600ms ${Math.min(1.5, i * 0.008)}s both` } : undefined} />
          ),
        )}
        <path d={step} fill="none" stroke="var(--ok)" strokeWidth={2.2} />
        <circle cx={X(current.meanDelay)} cy={Y(current.alarmsPer10)} r={7} fill="var(--brand)" stroke="var(--bg-elev-1)" strokeWidth={2} />
        <text x={X(current.meanDelay) + 11} y={Y(current.alarmsPer10) - 8} fontSize={11} fontWeight={700} fill="var(--brand)">current</text>
        {rec && (
          <g>
            <polygon points={star(X(rec.meanDelay), Y(rec.alarmsPer10), 11)} fill="var(--ok)" stroke="var(--bg-elev-1)" strokeWidth={1.5} />
            <text x={X(rec.meanDelay) + 13} y={Y(rec.alarmsPer10) + 4} fontSize={11} fontWeight={700} fill="var(--ok-ink)">recommended</text>
          </g>
        )}
      </svg>
      {hover && (
        <div className="tip" style={{ position: 'absolute', right: 12, top: 8, bottom: 'auto', left: 'auto', transform: 'none', textAlign: 'left' }}>
          threshold {hover.threshold.toFixed(2)} · deadband {hover.deadband.toFixed(2)} · on-delay {hover.onDelay}s<br />
          alarms/10 min {hover.alarmsPer10.toFixed(2)} · false {hover.falseAlarms.toFixed(2)} · delay {hover.meanDelay.toFixed(1)}s · missed {hover.missed}
        </div>
      )}
    </div>
  );
}
