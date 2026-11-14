import { CHANNELS, NODE_KM, neighbours, type Snapshot } from '../../engine';

/** Selected sensor and its +-2 hop neighbours placed at their true positions. Arc weight = 1/distance weight; colour = agreement. */
export function NeighbourGraph({ snap, ch }: { snap: Snapshot; ch: number }) {
  if (ch >= 12) return <p className="muted">Flow meters are checked by mass balance (FT-in - FT-del - FT-out) rather than neighbour pressures.</p>;
  const nb = neighbours(ch, 2);
  const W = 640;
  const H = 250;
  const L = 40;
  const R = 40;
  const axisY = 150;
  const kms = [NODE_KM[ch], ...nb.map((n) => NODE_KM[n.node])];
  const kmMin = Math.min(...kms) - 10;
  const kmMax = Math.max(...kms) + 10;
  const X = (km: number) => L + ((km - kmMin) / (kmMax - kmMin)) * (W - L - R);
  const dev = (c: number) => snap.measured[c] - snap.nominal[c];
  const selfDev = dev(ch);
  const wsum = nb.reduce((a, n) => a + n.w * Math.max(snap.trust[n.node].T, 0.02), 0);
  const col = (d: number) => (d < 0.5 ? 'var(--ok)' : d < 1.5 ? 'var(--warn)' : 'var(--bad)');
  const cx = X(NODE_KM[ch]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Neighbour graph for ${CHANNELS[ch].tag}: ${nb.length} neighbours within two hops`}>
      <line x1={L - 10} x2={W - R + 10} y1={axisY} y2={axisY} stroke="var(--pipe)" strokeWidth={8} strokeLinecap="round" />
      {nb.map((n) => {
        const x = X(NODE_KM[n.node]);
        const d = Math.abs(dev(n.node) - selfDev);
        const w = (n.w * Math.max(snap.trust[n.node].T, 0.02)) / (wsum || 1);
        const top = 40 + (1 - Math.min(1, w * 1.6)) * 20;
        return (
          <g key={n.node}>
            <path d={`M${x},${axisY - 12} C${x},${top} ${cx},${top} ${cx},${axisY - 12}`} fill="none" stroke={col(d)} strokeWidth={1.5 + w * 8} strokeLinecap="round" opacity={0.8} />
            <circle cx={x} cy={axisY} r={13} fill="var(--bg-elev-1)" stroke={snap.trust[n.node].cls === 'GOOD' ? 'var(--ok)' : snap.trust[n.node].cls === 'BAD' ? 'var(--bad)' : 'var(--warn)'} strokeWidth={2.5} />
            <text x={x} y={axisY + 1} textAnchor="middle" dominantBaseline="central" fontSize={10.5} fontWeight={700} fontFamily="var(--mono)" fill="var(--text)">{n.node}</text>
            <text x={x} y={axisY + 32} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--text)">PT-{n.node}</text>
            <text x={x} y={axisY + 47} textAnchor="middle" fontSize={10.5} fill="var(--text-muted)" fontFamily="var(--mono)">{n.km} km away</text>
            <text x={x} y={axisY + 62} textAnchor="middle" fontSize={10.5} fill="var(--text-muted)" fontFamily="var(--mono)">weight {(w * 100).toFixed(0)}%</text>
            <text x={x} y={axisY + 77} textAnchor="middle" fontSize={10.5} fill="var(--text-muted)" fontFamily="var(--mono)">Δ {dev(n.node).toFixed(2)} bar</text>
          </g>
        );
      })}
      <circle cx={cx} cy={axisY} r={17} fill="var(--brand)" stroke="var(--bg-elev-1)" strokeWidth={3} />
      <text x={cx} y={axisY + 1} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fontFamily="var(--mono)" fill="#fff">{ch}</text>
      <text x={cx} y={axisY + 32} textAnchor="middle" fontSize={11.5} fontWeight={700} fill="var(--text)">PT-{ch}</text>
      <text x={cx} y={axisY + 47} textAnchor="middle" fontSize={10.5} fill="var(--text-muted)" fontFamily="var(--mono)">selected</text>
      <text x={cx} y={axisY + 77} textAnchor="middle" fontSize={10.5} fill="var(--text-muted)" fontFamily="var(--mono)">Δ {selfDev.toFixed(2)} bar</text>
    </svg>
  );
}
