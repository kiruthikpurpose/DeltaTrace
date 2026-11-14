import { memo } from 'react';
import { CHANNELS, NOMINAL, type Simulation, type TrustState } from '../../engine';
import { runner } from '../../state/runner';
import { TrustGauge } from '../viz/TrustGauge';
import { Sparkline } from '../viz/Sparkline';
import { TrustBadge } from '../ui/Badge';

const COMPS: [string, (s: TrustState) => number, string][] = [
  ['Neighbour residual', (s) => Math.min(1, (s.c.z * s.c.z) / 16), 'var(--info)'],
  ['Mass balance', (s) => Math.min(1, s.c.M / 3), 'var(--c-tune)'],
  ['Signal behaviour', (s) => Math.min(1, s.c.S / 3), 'var(--c-group)'],
  ['Comms', (s) => Math.min(1, s.c.C / 4), 'var(--bad)'],
];

function spark(sim: Simulation, ch: number): number[] {
  const out: number[] = [];
  for (let t = Math.max(0, sim.t - 120); t < sim.t; t += 4) { const v = sim.measAt(ch, t) - NOMINAL[ch]; if (Number.isFinite(v)) out.push(v); }
  return out;
}

export const SensorCard = memo(function SensorCard({ st, selected, onSelect, tick }: { st: TrustState; selected: boolean; onSelect: (ch: number) => void; tick: number }) {
  void tick;
  const data = spark(runner.sim, st.ch);
  return (
    <button type="button" className={`sensor-card${selected ? ' sel' : ''}`} onClick={() => onSelect(st.ch)} aria-pressed={selected} aria-label={`${CHANNELS[st.ch].tag} trust ${st.T.toFixed(2)} ${st.cls}`}>
      <div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
        <TrustGauge value={st.T} cls={st.cls} size={56} stroke={6} />
        <div className="grow" style={{ minWidth: 0, textAlign: 'left' }}>
          <b className="mono">{CHANNELS[st.ch].tag}</b>
          <div className="row" style={{ gap: 4 }}>
            <TrustBadge cls={st.cls} />
            {st.likelyFault && st.cls !== 'GOOD' && <span className="badge neutral">{st.likelyFault}</span>}
          </div>
        </div>
      </div>
      <Sparkline data={data} width={200} height={26} color={st.cls === 'BAD' ? 'var(--bad)' : 'var(--brand)'} label={`${CHANNELS[st.ch].tag} signal`} />
      <div className="mini-bars">
        {COMPS.map(([n, f, c]) => (
          <div key={n} title={`${n}: ${(f(st) * 100).toFixed(0)}% penalty`}>
            <span className="muted">{n}</span>
            <span className="bar">
              <i style={{ width: `${Math.max(2, f(st) * 100)}%`, background: c }} />
            </span>
          </div>
        ))}
      </div>
    </button>
  );
});
