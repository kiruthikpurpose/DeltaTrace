import type { TrustClass } from '../../engine';
import { TRUST_COLOR } from '../../utils/colors';

export function TrustGauge({ value, cls, size = 64, stroke = 7, showText = true }: { value: number; cls: TrustClass; size?: number; stroke?: number; showText?: boolean }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Trust ${v.toFixed(2)} ${cls}`} className={cls === 'BAD' ? 'glow-bad' : undefined} style={{ flex: 'none' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-elev-3)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TRUST_COLOR[cls]} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dasharray 300ms var(--ease), stroke 300ms' }} />
      {showText && (
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontFamily="var(--mono)" fontWeight={700} fontSize={size * 0.27} fill="var(--text)">
          {v.toFixed(2)}
        </text>
      )}
    </svg>
  );
}
