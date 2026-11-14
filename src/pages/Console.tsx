import { History, Zap, ShieldAlert, Eye } from 'lucide-react';
import { useMemo } from 'react';
import { FT_DEL, FT_IN, FT_OUT, CHANNELS, NOMINAL } from '../engine';
import { AdvisoryShelf } from '../components/domain/AdvisoryShelf';
import { IncidentCard } from '../components/domain/IncidentCard';
import { IncidentDetail } from '../components/domain/IncidentDetail';
import { RawAlarmList } from '../components/domain/RawAlarmList';
import { SafetyRuleList } from '../components/domain/SafetyRules';
import { PageHeader } from '../components/shell/PageHeader';
import { Card } from '../components/ui/Card';
import { Drawer } from '../components/ui/Drawer';
import { Segmented } from '../components/ui/Segmented';
import { Slider } from '../components/ui/Slider';
import { Ticker } from '../components/ui/Ticker';
import { Toggle } from '../components/ui/Toggle';
import { FloodGauge } from '../components/viz/FloodGauge';
import { PipelineSchematic } from '../components/viz/PipelineSchematic';
import { StripChart } from '../components/viz/StripChart';
import { runner } from '../state/runner';
import { useSimStore } from '../state/simStore';
import { useUiStore } from '../state/uiStore';
import { TRUST_COLOR } from '../utils/colors';
import { incId } from '../utils/format';
import { EmptyState } from '../components/ui/EmptyState';
import { Waves } from 'lucide-react';

const PT_COLORS = ['var(--brand)', 'var(--c-trust)', 'var(--c-tune)', 'var(--c-group)', 'var(--info)', 'var(--bad)'];

export default function Console({ embedded }: { embedded?: boolean } = {}) {
  const snap = useSimStore((s) => s.snap)!;
  const replaying = useSimStore((s) => s.replaying);
  const ui = useUiStore();
  const open = ui.selectedIncident !== null ? [...snap.openIncidents, ...snap.recentClosed].find((i) => i.id === ui.selectedIncident) ?? null : null;
  const stripSeries = useMemo(() => ui.stripChannels.map((ch, i) => ({ id: `pt${ch}`, label: CHANNELS[ch].tag, ch, color: PT_COLORS[i % PT_COLORS.length] })), [ui.stripChannels]);
  const flowSeries = useMemo(
    () => [
      { id: 'in', label: 'FT-in', ch: FT_IN, color: PT_COLORS[0] },
      { id: 'del', label: 'FT-del', ch: FT_DEL, color: PT_COLORS[1] },
      { id: 'out', label: 'FT-out', ch: FT_OUT, color: PT_COLORS[2] },
      { id: 'mb', label: 'Balance residual', color: PT_COLORS[5], fn: (sim: typeof runner.sim, t: number) => sim.measAt(FT_IN, t) - sim.measAt(FT_DEL, t) - sim.measAt(FT_OUT, t) - (NOMINAL[FT_IN] - NOMINAL[FT_DEL] - NOMINAL[FT_OUT]) },
    ],
    [],
  );
  const toggleStrip = (ch: number) => {
    const cur = ui.stripChannels;
    ui.set({ stripChannels: cur.includes(ch) ? cur.filter((c) => c !== ch) : [...cur, ch].slice(-4) });
  };
  const incidents = snap.openIncidents;
  const criticalHidden = snap.criticalHidden;
  const items = snap.opTotal;
  return (
    <div className="page">
      {!embedded && (
        <PageHeader
        title="Live Console"
        purpose="Existing alarm list (left) against the DeltaTrace operator view (right), live."
        info={['Top: the 200 km pipeline. Rings under each sensor show trust; blue rings are pressure waves.', 'Left: every raw alarm the existing system raises.', 'Right: the same alarms grouped into incidents, classified and ranked. Nothing is deleted.', 'Inject faults with the button, the F key or keys 1–9.']}
        actions={
          <>
            <Toggle checked={ui.explain} onChange={(v) => ui.set({ explain: v })} label="Show the why" />
            <button className="btn" onClick={() => runner.startReplay()} disabled={!runner.canReplay() || replaying} title="Slow-motion 0.25× re-run of the last 5 minutes with captions">
              <History size={15} /> Replay last 5 minutes
            </button>
            <button className="btn primary" onClick={() => ui.set({ faultDrawer: true })}>
              <Zap size={15} /> Inject fault
            </button>
          </>
        }
      />

      )}

      <Card flush className="hero-card" label="Animated pipeline schematic">
        <div className="schematic-hint muted">Swipe sideways to pan the pipeline</div>
        <div className="schematic-scroll">
          <div style={{ padding: '8px 12px 4px' }}>
          <PipelineSchematic snap={snap} explain={ui.explain} showTruth={ui.showTruth} selectedIncident={open} />
          </div>
        </div>
      </Card>

      <div className="console-grid">
        <Card title="Raw alarm view (existing system)" sub="Every limit crossing becomes an alarm" accent="bad" className="col-raw">
          {snap.flood && (
            <div className="flood-banner" role="alert">
              <ShieldAlert size={18} aria-hidden /> ALARM FLOOD: {snap.raw10} alarms in 10 min
            </div>
          )}
          <div className="split-gauge">
            <FloodGauge value={snap.raw10} />
            <div className="counters">
              <div><span className="muted">Raw alarms total</span><b className="num"><Ticker value={snap.rawTotal} /></b></div>
              <div><span className="muted">Active</span><b className="num">{snap.rawActive}</b></div>
              <div><span className="muted">Chattering</span><b className="num">{snap.chattering}</b></div>
            </div>
          </div>
          <RawAlarmList alarms={snap.recentAlarms} />
        </Card>

        <Card title="DeltaTrace operator view" sub={snap.engineEnabled ? 'Incidents, ranked and explained' : 'FAIL-OPEN: raw alarms pass through unchanged'} accent="group" className="col-dt">
          <div className="counters row3">
            <div><span className="muted">Operator items</span><b className="num"><Ticker value={items} /></b></div>
            <div><span className="muted">Reduction</span><b className="num ok"><Ticker value={snap.reduction} decimals={0} suffix="%" /></b></div>
            <div className={criticalHidden ? 'bad' : ''}><span className="muted">Critical alarms hidden</span><b className={`num ${criticalHidden ? 'bad' : 'ok'}`}>{criticalHidden}</b></div>
          </div>
          <div className="trust-strip" role="list" aria-label="Sensor trust strip">
            {snap.trust.map((t) => (
              <button key={t.ch} role="listitem" className={`tchip ${t.cls}`} onClick={() => { toggleStrip(t.ch < 12 ? t.ch : 5); ui.set({ selectedChannel: t.ch }); }} title={`${CHANNELS[t.ch].tag} · trust ${t.T.toFixed(2)} · ${t.cls}${t.likelyFault ? ' · ' + t.likelyFault : ''}`} aria-label={`${CHANNELS[t.ch].tag} ${t.cls}`}>
                <i style={{ background: TRUST_COLOR[t.cls] }} />
                {t.ch < 12 ? t.ch : CHANNELS[t.ch].tag.replace('FT-', 'F')}
              </button>
            ))}
          </div>
          {snap.engineEnabled ? (
            <>
              <div className="inc-list" aria-label="Open incidents" aria-live="polite">
                {incidents.length === 0 && <EmptyState icon={<Waves />} title="No open incidents">Calm. Inject a fault to watch dozens of alarms become one incident.</EmptyState>}
                {incidents.map((i) => (
                  <IncidentCard key={i.id} inc={i} selected={ui.selectedIncident === i.id} onOpen={(id) => ui.set({ selectedIncident: id })} />
                ))}
                {incidents.length === 0 && snap.recentClosed.slice(0, 2).map((i) => <IncidentCard key={i.id} inc={i} onOpen={(id) => ui.set({ selectedIncident: id })} />)}
              </div>
              <AdvisoryShelf advisories={snap.advisories} />
            </>
          ) : (
            <>
              <div className="note warn" style={{ margin: '10px 0' }}>Fail-open: the engine is OFF, so this view mirrors the raw alarm list exactly. Turn it back ON to restore incidents.</div>
              <RawAlarmList alarms={snap.recentAlarms} />
            </>
          )}
        </Card>

        <div className="col-ctx stack">
          <Card title="Engine controls">
            <div className="stack">
              <Toggle checked={snap.cfg.engineEnabled} onChange={(v) => runner.setConfig({ engineEnabled: v })} label={<>DeltaTrace engine <b>{snap.cfg.engineEnabled ? 'ON' : 'OFF (fail-open)'}</b></>} />
              <div className="field">
                <span className="lbl">Grouping mode</span>
                <Segmented label="Grouping mode" value={snap.cfg.groupingMode} onChange={(v) => runner.setConfig({ groupingMode: v })} options={[{ id: 'delay', label: 'Delay-window' }, { id: 'fixed', label: 'Fixed 60 s' }]} />
              </div>
              <Toggle checked={snap.cfg.trustGating} onChange={(v) => runner.setConfig({ trustGating: v })} label="Trust gating for tuner" />
              <Slider label="Clock skew ±s" value={snap.cfg.clockSkew} min={0} max={5} step={0.5} unit=" s" onChange={(v) => runner.setConfig({ clockSkew: v })} />
              <Toggle checked={ui.showTruth} onChange={(v) => ui.set({ showTruth: v })} label={<><Eye size={13} aria-hidden /> Show ground truth</>} />
            </div>
          </Card>
          <Card title="Safety rules" sub="live compliance">
            <SafetyRuleList snap={snap} compact />
          </Card>
        </div>
      </div>

      <Card className="charts-card" title="Live strip charts" actions={<Segmented label="Window" value={ui.chartWindow} onChange={(v) => ui.set({ chartWindow: v })} options={[{ id: 60, label: '60 s' }, { id: 300, label: '5 min' }, { id: 600, label: '10 min' }]} />} sub="Triangles = raw alarms · dashed ticks = expected wave arrival (distance ÷ wave speed)">
        <div className="chart-grid">
          <div>
            <StripChart title="Pressure deviation (selected sensors)" unit="bar" series={stripSeries} windowSec={ui.chartWindow} minSpan={1} />
            <div className="row" style={{ marginTop: 6 }}>
              <span className="muted" style={{ fontSize: 12 }}>Sensors:</span>
              {CHANNELS.slice(0, 12).map((c) => (
                <button key={c.id} className="chip" aria-pressed={ui.stripChannels.includes(c.id)} onClick={() => toggleStrip(c.id)} style={{ padding: '1px 8px' }}>
                  {c.id}
                </button>
              ))}
            </div>
          </div>
          <StripChart title="Flow deviation & mass-balance residual" unit="m³/h" series={flowSeries} windowSec={ui.chartWindow} minSpan={20} showDelayTicks={false} />
        </div>
      </Card>

      <Drawer open={open !== null} wide onClose={() => ui.set({ selectedIncident: null })} title={open ? `Incident ${incId(open.id)}` : 'Incident'}>
        {open && <IncidentDetail inc={open} compact />}
      </Drawer>
    </div>
  );
}
