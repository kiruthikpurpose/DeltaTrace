export function FloodGauge({ value, max = 30, threshold = 10, label = 'alarms in last 10 min', size = 200 }: { value: number; max?: number; threshold?: number; label?: string; size?: number }) {
  const w = size;
  const h = size * 0.62;
  const cx = w / 2;
  const cy = h - 10;
  const r = w / 2 - 16;
  const ang = (v: number) => Math.PI * (1 - Math.min(1, v / max));
  const pt = (v: number, rad = r) => [cx + rad * Math.cos(ang(v)), cy - rad * Math.sin(ang(v))];
  const arc = (a: number, b: number) => {
    const [x1, y1] = pt(a);
    const [x2, y2] = pt(b);
    return `M${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2}`;
  };
  const flood = value >= threshold;
  const [tx1, ty1] = pt(threshold, r - 12);
  const [tx2, ty2] = pt(threshold, r + 10);
  const [nx, ny] = pt(Math.min(value, max), r - 6);
  return (
    <svg width={w} height={h + 26} viewBox={`0 0 ${w} ${h + 26}`} role="img" aria-label={`Flood meter: ${value} ${label}; flood threshold ${threshold}`} style={{ maxWidth: '100%' }}>
      <path d={arc(0, max)} fill="none" stroke="var(--bg-elev-3)" strokeWidth={14} strokeLinecap="round" />
      <path d={arc(0, Math.min(threshold - 0.01, Math.max(0.01, value)))} fill="none" stroke="var(--ok)" strokeWidth={14} strokeLinecap="round" opacity={value > 0 ? 1 : 0} />
      {value >= threshold && <path d={arc(threshold, Math.min(max, value))} fill="none" stroke="var(--bad)" strokeWidth={14} strokeLinecap="round" />}
      <line x1={tx1} y1={ty1} x2={tx2} y2={ty2} stroke="var(--text)" strokeWidth={2.5} />
      <text x={tx2} y={ty2 - 4} fontSize={11} fill="var(--text-muted)" textAnchor="middle">
        {threshold}
      </text>
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={flood ? 'var(--bad)' : 'var(--text)'} strokeWidth={3} strokeLinecap="round" style={{ transition: 'all 400ms var(--ease)' }} />
      <circle cx={cx} cy={cy} r={6} fill={flood ? 'var(--bad)' : 'var(--text)'} />
      <text x={cx} y={cy - r * 0.38} textAnchor="middle" fontFamily="var(--mono)" fontWeight={700} fontSize={size * 0.19} fill={flood ? 'var(--bad-ink)' : 'var(--text)'}>
        {value}
      </text>
      <text x={cx} y={h + 18} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
        {label}
      </text>
    </svg>
  );
}
