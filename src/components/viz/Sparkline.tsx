export function Sparkline({ data: raw, width = 100, height = 28, color = 'var(--brand)', label, fill = true }: { data: number[]; width?: number; height?: number; color?: string; label?: string; fill?: boolean }) {
  const data = raw.filter((v) => Number.isFinite(v));
  if (data.length < 2) return <svg width={width} height={height} aria-hidden />;
  const mn = Math.min(...data);
  const mx = Math.max(...data);
  const span = mx - mn || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * width, height - 2 - ((v - mn) / span) * (height - 4)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label ?? 'trend'} style={{ flex: 'none' }}>
      {fill && <path d={`${d} L${width},${height} L0,${height} Z`} fill={color} opacity={0.14} />}
      <path d={d} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
