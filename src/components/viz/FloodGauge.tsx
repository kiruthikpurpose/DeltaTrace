/** Flat linear meter: value against a flood threshold, with a numeric readout. */
export function FloodGauge({ value, max = 30, threshold = 10, label = 'alarms in last 10 min', size = 200 }: { value: number; max?: number; threshold?: number; label?: string; size?: number }) {
  const flood = value >= threshold;
  const pct = (v: number) => `${(Math.min(1, Math.max(0, v / max)) * 100).toFixed(2)}%`;
  return (
    <div role="img" aria-label={`Flood meter: ${value} ${label}; flood threshold ${threshold}`} style={{ width: size, maxWidth: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 34, lineHeight: 1, color: flood ? 'var(--bad-ink)' : 'var(--text)' }}>{value}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <div style={{ position: 'relative', height: 10, marginTop: 12, background: 'var(--bg-elev-3)', borderRadius: 2 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct(value), background: flood ? 'var(--bad)' : 'var(--ok)', borderRadius: 2, transition: 'width 400ms var(--ease), background 300ms' }} />
        <div style={{ position: 'absolute', left: pct(threshold), top: -4, bottom: -4, width: 2, background: 'var(--text)' }} />
      </div>
      <div style={{ position: 'relative', height: 16, marginTop: 4, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
        <span style={{ position: 'absolute', left: 0 }}>0</span>
        <span style={{ position: 'absolute', left: pct(threshold), transform: 'translateX(-50%)' }}>{threshold} flood</span>
        <span style={{ position: 'absolute', right: 0 }}>{max}</span>
      </div>
    </div>
  );
}
