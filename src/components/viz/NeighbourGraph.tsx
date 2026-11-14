import { CHANNELS, NODE_KM, neighbours, type Snapshot } from '../../engine';

/** Selected sensor with its ±2-hop neighbours; edge width = weight, colour = agreement. */
export function NeighbourGraph({ snap, ch }: { snap: Snapshot; ch: number }) {
  if (ch >= 12) return <p className="muted">Flow meters are checked by mass balance (FT-in − FT-del − FT-out) rather than neighbour pressures.</p>;
  const nb = neighbours(ch, 2);
  const W = 560;
  const H = 190;
  const cx = W / 2;
  const cy = 95;
  const maxW = Math.max(...nb.map((n) => n.w));
  const dev = (c: number) => snap.measured[c] - snap.nominal[c];
  const selfDev = dev(ch);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Neighbour graph for ${CHANNELS[ch].tag}: ${nb.length} neighbours`}>
      {nb.map((n) => {
        const dx = ((NODE_KM[n.node] - NODE_KM[ch]) / 40) * 120;
        const x = cx + dx;
        const y = cy + (Math.abs(n.node - ch) === 2 ? 38 : -32);
        const agree = Math.abs(dev(n.node) - selfDev) < 0.5 ? 'var(--ok)' : Math.abs(dev(n.node) - selfDev) < 1.5 ? 'var(--warn)' : 'var(--bad)';
        return (
          <g key={n.node}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke={agree} strokeWidth={1 + (n.w / maxW) * 7} strokeLinecap="round" opacity={0.75} />
            <circle cx={x} cy={y} r={20} fill="var(--bg-elev-1)" stroke={snap.trust[n.node].cls === 'GOOD' ? 'var(--ok)' : snap.trust[n.node].cls === 'BAD' ? 'var(--bad)' : 'var(--warn)'} strokeWidth={3} />
            <text x={x} y={y - 2} textAnchor="middle" fontSize={11} fontWeight={700} fontFamily="var(--mono)" fill="var(--text)">PT-{n.node}</text>
            <text x={x} y={y + 10} textAnchor="middle" fontSize={9.5} fill="var(--text-muted)">{n.km} km</text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={28} fill="var(--brand-soft)" stroke="var(--brand)" strokeWidth={3} />
      <text x={cx} y={cy - 3} textAnchor="middle" fontSize={13} fontWeight={800} fontFamily="var(--mono)" fill="var(--text)">PT-{ch}</text>
      <text x={cx} y={cy + 11} textAnchor="middle" fontSize={10} fill="var(--text-muted)">Δ {selfDev.toFixed(2)} bar</text>
    </svg>
  );
}
