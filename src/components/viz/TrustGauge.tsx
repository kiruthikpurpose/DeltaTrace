import type { TrustClass } from '../../engine';
import { TRUST_COLOR } from '../../utils/colors';

/** Flat trust meter: numeric readout above a thin bar with class-threshold ticks. */
export function TrustGauge({ value, cls, size = 64, stroke = 7, showText = true }: { value: number; cls: TrustClass; size?: number; stroke?: number; showText?: boolean }) {
  const v = Math.max(0, Math.min(1, value));
  const w = Math.max(36, size);
  const h = Math.max(4, Math.round(stroke * 0.8));
  return (
    <div role="img" aria-label={`Trust ${v.toFixed(2)} ${cls}`} style={{ width: w, flex: 'none' }}>
      {showText && <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: Math.max(12, size * 0.26), lineHeight: 1.1, marginBottom: 4, color: 'var(--text)' }}>{v.toFixed(2)}</div>}
      <div style={{ position: 'relative', height: h, background: 'var(--bg-elev-3)', borderRadius: 1 }}>
        <div style={{ width: `${v * 100}%`, height: '100%', background: TRUST_COLOR[cls], borderRadius: 1, transition: 'width 300ms var(--ease), background 300ms' }} />
        {[0.4, 0.7].map((t) => <span key={t} style={{ position: 'absolute', left: `${t * 100}%`, top: -1, bottom: -1, width: 1, background: 'var(--bg)' }} />)}
      </div>
    </div>
  );
}
