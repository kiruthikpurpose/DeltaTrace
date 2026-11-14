import { useNavigate } from 'react-router-dom';
import { CHANNELS, NODES, type Snapshot } from '../../engine';
import { useUiStore } from '../../state/uiStore';
import { TrustGauge } from './TrustGauge';

/** Phone layout of the pipeline: one row per node, flow direction top to bottom. */
export function PipelineCompact({ snap }: { snap: Snapshot }) {
  const nav = useNavigate();
  const alarms = new Map<number, number>();
  for (const a of snap.activeAlarms) if (a.source === 'scada') alarms.set(a.node, (alarms.get(a.node) ?? 0) + 1);
  const faultNodes = new Map<number, string>();
  for (const f of snap.faults) if (f.started && f.kind === 'process') {
    const n = f.spec.node ?? (f.km !== null ? NODES.reduce((b, x) => (Math.abs(x.km - (f.km ?? 0)) < Math.abs(NODES[b].km - (f.km ?? 0)) ? x.id : b), 0) : 0);
    faultNodes.set(n, f.spec.type === 'leak' ? `Leak at km ${f.km}` : f.spec.type === 'pumpTrip' ? 'Pump trip' : f.spec.type === 'valveClosure' ? 'Valve closure' : 'Event');
  }
  return (
    <ol className="compact-pipe" aria-label="Pipeline nodes from km 0 to km 200">
      {NODES.map((n) => {
        const st = snap.trust[n.id];
        const al = alarms.get(n.id);
        return (
          <li key={n.id}>
            <button type="button" onClick={() => { useUiStore.getState().set({ selectedChannel: n.id }); nav('/trust'); }} aria-label={`${CHANNELS[n.id].tag} ${n.name} at km ${n.km}, trust ${st.T.toFixed(2)} ${st.cls}`}>
              <span className="cp-km mono">{n.km}</span>
              <TrustGauge value={st.T} cls={st.cls} size={34} stroke={4} showText={false} />
              <span className="cp-main">
                <b>{CHANNELS[n.id].tag}</b> <span className="muted">{n.name}</span>
                <span className="cp-sub muted">{(snap.measured[n.id]).toFixed(1)} bar · trust {st.T.toFixed(2)}{st.likelyFault && st.cls !== 'GOOD' ? ` · ${st.likelyFault}` : ''}</span>
              </span>
              {faultNodes.has(n.id) && <span className="badge bad">{faultNodes.get(n.id)}</span>}
              {al ? <span className={`badge ${snap.activeAlarms.some((a) => a.node === n.id && a.safetyCritical) ? 'bad' : 'warn'}`}>{al} alarm{al > 1 ? 's' : ''}</span> : null}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
