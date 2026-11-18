import { CHANNELS, NODES, NODE_KM, type Snapshot } from '../../engine';
import { TRUST_COLOR } from '../../utils/colors';

const W = 1160;
const X0 = 40;
const X1 = W - 40;
const xOf = (km: number) => X0 + (km / 200) * (X1 - X0);

/** Slim live overview of the line: sensor trust, active alarms and open incident spans. */
export function PipelineStrip({ snap }: { snap: Snapshot }) {
  const alarmed = new Set(snap.activeAlarms.map((a) => a.node));
  const open = snap.openIncidents.length;
  return (
    <svg viewBox={`0 0 ${W} 108`} width="100%" role="img" aria-label={`Pipeline overview: ${NODES.length} sensor nodes, ${alarmed.size} with active alarms, ${open} open incident${open === 1 ? '' : 's'}`} style={{ display: 'block' }}>
      {snap.openIncidents.map((inc) => {
        const kms = inc.channels.length ? inc.channels.map((c) => CHANNELS[c].km) : [NODE_KM[inc.segment[0]]];
        const lo = Math.min(...kms);
        const hi = Math.max(...kms);
        const col = inc.cls === 'process-event' ? 'var(--c-group)' : inc.cls === 'data-integrity' ? 'var(--k-integrity)' : 'var(--k-fault)';
        return <rect key={inc.id} x={xOf(lo) - 18} y={14} width={xOf(hi) - xOf(lo) + 36} height={62} rx={6} fill={col} opacity={0.14} stroke={col} strokeOpacity={0.6} />;
      })}
      <line x1={X0} x2={X1} y1={46} y2={46} stroke="var(--pipe)" strokeWidth={10} strokeLinecap="round" />
      <line x1={X0} x2={X1} y1={46} y2={46} stroke="var(--pipe-inner)" strokeWidth={4} strokeLinecap="round" />
      {NODES.map((n) => {
        const st = snap.trust[n.id];
        const x = xOf(n.km);
        return (
          <g key={n.id}>
            {alarmed.has(n.id) && <circle cx={x} cy={46} r={14} fill="none" stroke="var(--warn)" strokeWidth={2.5} />}
            <circle cx={x} cy={46} r={8} fill={TRUST_COLOR[st.cls]} stroke="var(--bg-elev-1)" strokeWidth={2} />
            <text className="strip-lbl" x={x} y={86} textAnchor="middle" fontSize={11} fill="var(--text-muted)" fontFamily="var(--mono)">{n.km}</text>
          </g>
        );
      })}
      <text className="strip-lbl" x={X1 + 4} y={100} textAnchor="end" fontSize={11} fill="var(--chart-axis)">km along the line</text>
    </svg>
  );
}
