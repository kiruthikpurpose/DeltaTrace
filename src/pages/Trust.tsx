import { useMemo } from 'react';
import { CHANNELS, NOMINAL, neighbours, type Simulation, type SensorFaultType } from '../engine';
import { SensorCard } from '../components/domain/SensorCard';
import { PageHeader } from '../components/shell/PageHeader';
import { TrustBadge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Legend } from '../components/ui/Legend';
import { NeighbourGraph } from '../components/viz/NeighbourGraph';
import { StripChart } from '../components/viz/StripChart';
import { TrustGauge } from '../components/viz/TrustGauge';
import { TrustHeatmap } from '../components/viz/TrustHeatmap';
import { runner } from '../state/runner';
import { useSimStore } from '../state/simStore';
import { useUiStore } from '../state/uiStore';

function predictedDev(sim: Simulation, ch: number, t: number): number {
  if (ch >= 12) return 0;
  let sw = 0;
  let sp = 0;
  for (const n of neighbours(ch, 2)) {
    const v = sim.measAt(n.node, t) - NOMINAL[n.node];
    if (!Number.isFinite(v)) continue;
    sw += n.w;
    sp += n.w * v;
  }
  return sw ? sp / sw : 0;
}

const FAULT_BTNS: { id: SensorFaultType; label: string }[] = [
  { id: 'stuck', label: 'Stuck' },
  { id: 'drift', label: 'Drift' },
  { id: 'spike', label: 'Spike storm' },
  { id: 'replay', label: 'Replay' },
  { id: 'falseDrop', label: 'False drop' },
  { id: 'comms', label: 'Comms loss' },
];

export default function Trust() {
  const snap = useSimStore((s) => s.snap)!;
  const tick = useSimStore((s) => s.tick);
  const ch = useUiStore((s) => s.selectedChannel);
  const st = snap.trust[ch];
  const cfg = snap.cfg;
  const c = st.c;
  const series = useMemo(
    () =>
      ch < 12
        ? [
            { id: 'meas', label: 'Measured', ch, color: 'var(--brand)' },
            { id: 'pred', label: 'Predicted from neighbours', fn: (s: Simulation, t: number) => predictedDev(s, ch, t), color: 'var(--c-trust)' },
          ]
        : [{ id: 'meas', label: 'Measured', ch, color: 'var(--brand)' }],
    [ch],
  );
  const resid = useMemo(() => [{ id: 'res', label: 'Residual', fn: (s: Simulation, t: number) => (ch < 12 ? s.measAt(ch, t) - NOMINAL[ch] - predictedDev(s, ch, t) : 0), color: 'var(--c-tune)' }], [ch]);
  const faultsOn = snap.faults.filter((f) => f.kind === 'sensor' && f.channels.includes(ch));
  const penalty = cfg.lambdaR * c.z * c.z + cfg.lambdaS * c.S + cfg.lambdaC * c.C + cfg.lambdaM * c.M;
  const explain =
    st.cls === 'GOOD'
      ? 'This sensor agrees with its neighbours, behaves like a real signal and reports on time. Alarms from it are taken at face value.'
      : st.likelyFault === 'stuck'
        ? 'The value is frozen while the physical neighbours keep moving. Its alarms are kept visible as Instrument Advisories and are not allowed to start an incident on their own.'
        : st.likelyFault === 'replay'
          ? 'The recent signal is an exact copy of an earlier recording, a classic spoofing pattern. It is flagged as a data-integrity anomaly.'
          : st.likelyFault === 'stale'
            ? 'No fresh data has arrived. After 15 s it is stale, after 60 s the quality is BAD. Neighbours cover for it.'
            : st.likelyFault === 'drift'
              ? 'The reading is slowly walking away from what its neighbours predict.'
              : 'The reading disagrees with its neighbours in a way no real pressure wave explains.';
  return (
    <div className="page">
      <PageHeader
        title="Trust Center"
        purpose="Live trust score per sensor from four checks: neighbours, mass balance, signal, communications."
        info={['Green = GOOD (≥ 0.7), amber = UNCERTAIN, red hatched = BAD (< 0.4).', 'A real event seen by several neighbours does not lower trust: the engine widens its tolerance instead.', 'Once BAD, a sensor needs T ≥ 0.55 for 3 scans in a row to recover (hysteresis).']}
      />
      <Card title="Trust heatmap" sub="15 channels × last 10 minutes · click a row to select · hatched = BAD" accent="trust">
        <TrustHeatmap />
        <div style={{ marginTop: 10 }}>
          <Legend items={[{ color: 'var(--ok)', label: 'GOOD ≥ 0.7' }, { color: 'var(--warn)', label: 'UNCERTAIN 0.4–0.7' }, { color: 'var(--bad)', label: 'BAD < 0.4 (hatched). Leaving BAD needs T ≥ 0.55 for 3 scans (hysteresis)' }]} />
        </div>
      </Card>

      <div className="trust-layout">
        <div className="sensor-grid" aria-label="Sensor cards">
          {snap.trust.map((t) => (
            <SensorCard key={t.ch} st={t} tick={tick >> 2} selected={t.ch === ch} onSelect={(c2) => useUiStore.getState().set({ selectedChannel: c2 })} />
          ))}
        </div>
        <Card title={`Sensor detail · ${CHANNELS[ch].tag}`} accent="trust" className="detail-panel">
          <div className="stack">
            <div className="row" style={{ gap: 14 }}>
              <TrustGauge value={st.T} cls={st.cls} size={92} />
              <div className="stack" style={{ gap: 4 }}>
                <TrustBadge cls={st.cls} />
                <span className="muted">likely fault: <b>{st.likelyFault ?? 'none'}</b></span>
                <span className="muted">raw T this scan: <b className="num">{st.Traw.toFixed(2)}</b></span>
              </div>
            </div>
            <p>{explain}</p>
            <div>
              <b style={{ fontSize: 12 }}>Formula with live numbers</b>
              <div className="code">
                {`T = exp(−(${cfg.lambdaR}·z² + ${cfg.lambdaS}·S + ${cfg.lambdaC}·C + ${cfg.lambdaM}·M))\n  = exp(−(${cfg.lambdaR}·${c.z.toFixed(2)}² + ${cfg.lambdaS}·${c.S.toFixed(2)} + ${cfg.lambdaC}·${c.C.toFixed(2)} + ${cfg.lambdaM}·${c.M.toFixed(2)}))\n  = exp(−${penalty.toFixed(2)}) = ${st.Traw.toFixed(3)}  →  smoothed T = ${st.T.toFixed(3)}`}
              </div>
              <p className="muted" style={{ fontSize: 12 }}>
                z = neighbour residual ({c.residual.toFixed(2)} bar ÷ σ {c.sigma.toFixed(2)}){c.coherent ? ' · σ widened: neighbours move coherently (real transient)' : ''}, S = signal behaviour, C = comms age, M = mass balance.
              </p>
            </div>
            <div className="row">
              {FAULT_BTNS.map((b) => (
                <button key={b.id} className="btn sm" onClick={() => runner.inject({ type: b.id, channel: ch })} disabled={ch >= 12 && b.id === 'drift' ? false : false}>
                  {b.label}
                </button>
              ))}
              <button className="btn sm primary" onClick={() => faultsOn.forEach((f) => runner.clearFault(f.id))} disabled={faultsOn.length === 0}>
                Clear
              </button>
            </div>
          </div>
        </Card>
      </div>

      <div className="two-col">
        <Card title="Predicted vs measured" sub="Deviation from nominal (bar). Predicted = inverse-distance average of the ±2-hop neighbours.">
          <StripChart title={`${CHANNELS[ch].tag} signal`} unit={ch < 12 ? 'bar' : 'm³/h'} series={series} windowSec={300} minSpan={ch < 12 ? 0.6 : 10} showDelayTicks={false} />
          <div style={{ height: 8 }} />
          <StripChart title="Residual (measured − predicted)" unit="bar" series={resid} windowSec={300} minSpan={0.6} showDelayTicks={false} height={130} showAlarms={false} />
        </Card>
        <Card title="Neighbour graph" sub="Edge width = weight (1/distance); colour = agreement with this sensor">
          <NeighbourGraph snap={snap} ch={ch} />
          <Legend items={[{ color: 'var(--ok)', label: 'agrees' }, { color: 'var(--warn)', label: 'differs' }, { color: 'var(--bad)', label: 'disagrees' }]} />
        </Card>
      </div>
    </div>
  );
}
