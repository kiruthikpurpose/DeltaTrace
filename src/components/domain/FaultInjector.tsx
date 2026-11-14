import { Zap } from 'lucide-react';
import { useState } from 'react';
import { CHANNELS, FAULT_LABELS, NODES, SCENARIOS, type FaultSpec, type Size } from '../../engine';
import { describeFault, runner } from '../../state/runner';
import { useSimStore } from '../../state/simStore';
import { Segmented } from '../ui/Segmented';
import { Slider } from '../ui/Slider';

export interface QuickFault {
  key: string;
  label: string;
  hint: string;
  specs: FaultSpec[];
}
export const QUICK_FAULTS: QuickFault[] = [
  { key: '1', label: 'Pump trip at PS-2', hint: 'One event, dozens of alarms', specs: [{ type: 'pumpTrip', node: 4 }] },
  { key: '2', label: 'Leak at km 87', hint: 'Origin estimate near km 87', specs: [{ type: 'leak', km: 87, size: 'medium' }] },
  { key: '3', label: 'Freeze sensor PT-7', hint: 'Trust drops, alarm becomes an advisory', specs: [{ type: 'stuck', channel: 7 }] },
  { key: '4', label: 'Replay / spoof PT-3', hint: 'Data-integrity anomaly', specs: [{ type: 'replay', channel: 3 }] },
  { key: '5', label: 'False injection PT-9', hint: 'Fake −5 bar “leak”', specs: [{ type: 'falseDrop', channel: 9 }] },
  { key: '6', label: 'Comms outage N6–N8', hint: 'Three RTUs go stale', specs: [{ type: 'comms', channels: [6, 7, 8] }] },
  { key: '7', label: 'Comms outage + leak km 40', hint: 'Two separate incidents', specs: [{ type: 'comms', channels: [6, 7, 8], duration: 240 }, { type: 'leak', km: 40, size: 'medium', delay: 8 }] },
  { key: '8', label: 'Valve closure at N5', hint: 'Upstream surge, downstream drop', specs: [{ type: 'valveClosure', node: 5, size: 'medium' }] },
  { key: '9', label: 'Batch interface at FT-del', hint: 'Known flow false-alarm source', specs: [{ type: 'batch', channel: 13, duration: 90 }] },
];
export function injectQuick(q: QuickFault) {
  for (const s of q.specs) runner.inject(s);
}

export function FaultInjector() {
  const snap = useSimStore((s) => s.snap)!;
  const [km, setKm] = useState(87);
  const [size, setSize] = useState<Size>('medium');
  const [pump, setPump] = useState(4);
  const [valve, setValve] = useState(5);
  const [sType, setSType] = useState<'stuck' | 'drift' | 'spike' | 'replay' | 'falseDrop' | 'comms'>('stuck');
  const [sCh, setSCh] = useState(7);
  const [sc, setSc] = useState('S1');
  return (
    <div className="stack" style={{ gap: 18 }}>
      <section>
        <h4 className="sect">Quick faults</h4>
        <div className="quick-grid">
          {QUICK_FAULTS.map((q) => (
            <button key={q.key} className="btn quick" onClick={() => injectQuick(q)} title={q.hint}>
              <kbd>{q.key}</kbd>
              <span style={{ textAlign: 'left' }}>
                <b style={{ display: 'block' }}>{q.label}</b>
                <small className="muted">{q.hint}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="stack">
        <h4 className="sect">Leak</h4>
        <Slider label="Position" value={km} min={0} max={200} step={1} unit=" km" onChange={setKm} />
        <div className="row">
          <Segmented label="Leak size" value={size} onChange={setSize} options={[{ id: 'small', label: 'Small' }, { id: 'medium', label: 'Medium' }, { id: 'large', label: 'Large' }]} />
          <button className="btn danger sm" onClick={() => runner.inject({ type: 'leak', km, size })}>
            <Zap size={14} /> Inject leak
          </button>
        </div>
      </section>
      <section className="stack">
        <h4 className="sect">Pump trip / valve closure</h4>
        <div className="row">
          <select className="input" value={pump} onChange={(e) => setPump(Number(e.target.value))} aria-label="Pump station">
            {[0, 4, 8].map((n) => (
              <option key={n} value={n}>
                {NODES[n].name} (km {NODES[n].km})
              </option>
            ))}
          </select>
          <button className="btn sm" onClick={() => runner.inject({ type: 'pumpTrip', node: pump })}>Trip pump</button>
        </div>
        <div className="row">
          <select className="input" value={valve} onChange={(e) => setValve(Number(e.target.value))} aria-label="Valve node">
            {NODES.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name} (km {n.km})
              </option>
            ))}
          </select>
          <button className="btn sm" onClick={() => runner.inject({ type: 'valveClosure', node: valve, size: 'medium' })}>Close valve</button>
        </div>
      </section>
      <section className="stack">
        <h4 className="sect">Sensor faults &amp; attacks</h4>
        <div className="row">
          <select className="input" value={sType} onChange={(e) => setSType(e.target.value as typeof sType)} aria-label="Sensor fault type">
            {(['stuck', 'drift', 'spike', 'replay', 'falseDrop', 'comms'] as const).map((t) => (
              <option key={t} value={t}>
                {FAULT_LABELS[t]}
              </option>
            ))}
          </select>
          <select className="input" value={sCh} onChange={(e) => setSCh(Number(e.target.value))} aria-label="Channel">
            {CHANNELS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.tag}
              </option>
            ))}
          </select>
          <button className="btn sm" onClick={() => runner.inject({ type: sType, channel: sCh })}>Inject</button>
        </div>
        <Slider label="Clock skew (±s)" value={snap.cfg.clockSkew} min={0} max={5} step={0.5} unit=" s" onChange={(v) => runner.setConfig({ clockSkew: v })} />
        <button className="btn sm" onClick={() => runner.inject({ type: 'batch', channel: 13, duration: 90 })}>Batch interface at FT-del</button>
      </section>
      <section className="stack">
        <h4 className="sect">Run a scenario (S0–S8)</h4>
        <div className="row">
          <select className="input" value={sc} onChange={(e) => setSc(e.target.value)} aria-label="Scenario">
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id} · {s.name}
              </option>
            ))}
          </select>
          <button className="btn sm" onClick={() => runner.runScenario(SCENARIOS.find((s) => s.id === sc)!)}>Script on live sim</button>
        </div>
      </section>
      <section className="stack">
        <h4 className="sect">Active faults ({snap.faults.length})</h4>
        {snap.faults.length === 0 && <p className="muted">None: normal operation.</p>}
        {snap.faults.map((f) => (
          <div key={f.id} className="row fault-row">
            <span className={`badge ${f.started ? 'warn' : 'neutral'}`}>{f.started ? 'active' : `in ${Math.max(0, Math.round(f.startAt - snap.t))}s`}</span>
            <span className="grow">{describeFault(f.spec)}</span>
            <button className="btn sm" onClick={() => runner.clearFault(f.id)}>Clear</button>
          </div>
        ))}
        <button className="btn" onClick={() => runner.clearAll()} disabled={snap.faults.length === 0}>Clear all faults</button>
      </section>
    </div>
  );
}
