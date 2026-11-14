/** Closed loop: trust → grouping → labelled events → tuning → fewer false alarms → cleaner data → better trust. */
export function LoopDiagram({ size = 360, labels = true, numbers }: { size?: number; labels?: boolean; numbers?: { trust?: string; group?: string; tune?: string } }) {
  const cx = 180;
  const cy = 180;
  const R = 110;
  const pos = [0, 1, 2].map((i) => {
    const a = (-90 + i * 120) * (Math.PI / 180);
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  const names = ['Trust', 'Grouping', 'Tuning'];
  const cols = ['var(--c-trust)', 'var(--c-group)', 'var(--c-tune)'];
  const sub = [numbers?.trust ?? 'sensor trust', numbers?.group ?? 'incidents', numbers?.tune ?? 'safe settings'];
  const arc = (i: number) => {
    const a = pos[i];
    const b = pos[(i + 1) % 3];
    return `M${a.x},${a.y} A${R * 1.05},${R * 1.05} 0 0 1 ${b.x},${b.y}`;
  };
  return (
    <svg viewBox="0 0 360 360" width={size} height={size} role="img" aria-label="Closed loop: trust feeds grouping, grouping produces labelled events, labelled events feed tuning, tuning cuts false alarms, which gives cleaner data and better trust." style={{ maxWidth: '100%' }}>
      <g style={{ transformOrigin: '180px 180px', animation: 'spin 60s linear infinite' }}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--border)" strokeDasharray="2 8" strokeWidth={2} />
      </g>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <path id={`loop-arc-${i}`} d={arc(i)} fill="none" stroke={cols[i]} strokeWidth={3.5} opacity={0.45} strokeDasharray="8 7" style={{ animation: 'dash-flow 1.2s linear infinite' }} />
          {[0, 1, 2].map((k) => (
            <circle key={k} r={4.5} fill={cols[i]}>
              <animateMotion dur="3.6s" begin={`${k * 1.2}s`} repeatCount="indefinite" path={arc(i)} />
            </circle>
          ))}
        </g>
      ))}
      {pos.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={44} fill="var(--bg-elev-1)" stroke={cols[i]} strokeWidth={4} />
          <text x={p.x} y={p.y - 3} textAnchor="middle" fontSize={14} fontWeight={800} fill="var(--text)">{names[i]}</text>
          {labels && <text x={p.x} y={p.y + 14} textAnchor="middle" fontSize={10} fill="var(--text-muted)">{sub[i]}</text>}
        </g>
      ))}
      {labels && (
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
          <tspan x={cx} dy={-6}>cleaner data</tspan>
          <tspan x={cx} dy={14}>→ better trust</tspan>
        </text>
      )}
    </svg>
  );
}
