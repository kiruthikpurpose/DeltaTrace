import { Play, ShieldCheck, Check, FileText } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TUNER_CLASSES, evaluateSetting, generateTraining, runTuner, settingOf, trainingFromSim, concatTraining, type TrainingSet, type TunerClassId, type TunerResult, type ChangeProposal } from '../engine';
import { ChangeLog } from '../components/domain/ChangeLog';
import { PageHeader } from '../components/shell/PageHeader';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Segmented } from '../components/ui/Segmented';
import { Toggle } from '../components/ui/Toggle';
import { Kpi } from '../components/ui/Kpi';
import { ParetoChart } from '../components/viz/ParetoChart';
import { LoopDiagram } from '../components/viz/LoopDiagram';
import { runner } from '../state/runner';
import { useSimStore } from '../state/simStore';
import { toast } from '../state/toastStore';
import { tunerReport } from '../utils/reports';
import { useLogStore } from '../state/logStore';
import { runLoopIterations, type LoopIteration } from '../engine/experiments';

type Sel = TunerClassId | 'all';

export default function Tuner() {
  const snap = useSimStore((s) => s.snap)!;
  const [sel, setSel] = useState<Sel>('roc');
  const [gate, setGate] = useState(true);
  const [useLive, setUseLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Partial<Record<TunerClassId, TunerResult>>>({});
  const [contam, setContam] = useState<Partial<Record<TunerClassId, TunerResult>>>({});
  const [clean, setClean] = useState<Partial<Record<TunerClassId, { g: number; u: number }>>>({});
  const [confirm, setConfirm] = useState<ChangeProposal[] | null>(null);
  const [loop, setLoop] = useState<LoopIteration[] | null>(null);
  const [loopBusy, setLoopBusy] = useState(false);
  const tsRef = useRef<TrainingSet | null>(null);
  const [preBase, setPreBase] = useState<{ raw: number } | null>(null);
  const changes = useLogStore((s) => s.changeLog);
  const classes = sel === 'all' ? TUNER_CLASSES.map((c) => c.id) : [sel];
  const shown = sel === 'all' ? 'roc' : sel;
  const res = results[shown];
  const metaOf = (id: TunerClassId) => TUNER_CLASSES.find((c) => c.id === id)!;

  const run = async () => {
    setBusy(true);
    setProgress(0);
    setResults({});
    setContam({});
    setPreBase({ raw: runner.sim.raw10 });
    await new Promise((r) => setTimeout(r, 30));
    let ts = generateTraining();
    if (useLive) ts = concatTraining([ts, trainingFromSim(runner.sim)]);
    tsRef.current = ts;
    const out: Partial<Record<TunerClassId, TunerResult>> = {};
    const outC: Partial<Record<TunerClassId, TunerResult>> = {};
    const outClean: Partial<Record<TunerClassId, { g: number; u: number }>> = {};
    for (let i = 0; i < classes.length; i++) {
      const c = classes[i];
      const g = await runTuner(ts, c, runner.sim.cfg, { gate, onProgress: (f) => setProgress((i + f) / classes.length) });
      const u = await runTuner(ts, c, runner.sim.cfg, { gate: !gate });
      out[c] = g;
      outC[c] = u;
      const cur = settingOf(runner.sim.cfg, c);
      const gg = gate ? g : u;
      const uu = gate ? u : g;
      if (gg.proposal && uu.proposal) outClean[c] = { g: evaluateSetting(ts, c, runner.sim.cfg, gg.proposal.new, cur).J, u: evaluateSetting(ts, c, runner.sim.cfg, uu.proposal.new, cur).J };
    }
    setResults(out);
    setContam(outC);
    setClean(outClean);
    setProgress(1);
    setBusy(false);
  };

  const proposals = classes.map((c) => results[c]?.proposal).filter((p): p is ChangeProposal => !!p);
  const approve = () => {
    for (const p of confirm ?? []) runner.approve(p);
    setConfirm(null);
  };
  useEffect(() => {
    document.title = 'Alarm Tuner · DeltaTrace Live';
  }, []);
  // first visit: run the replay so the Pareto chart is never empty
  const auto = useRef(false);
  useEffect(() => {
    if (auto.current || import.meta.env.MODE === 'test') return;
    auto.current = true;
    void run();
  }, []);
  const runLoop = async () => {
    setLoopBusy(true);
    setLoop(null);
    const it = await runLoopIterations(3, 19);
    setLoop(it);
    setLoopBusy(false);
  };
  const cmp = useMemo(() => {
    const g = gate ? results[shown] : contam[shown];
    const u = gate ? contam[shown] : results[shown];
    return { g, u };
  }, [results, contam, shown, gate]);

  return (
    <div className="page">
      <PageHeader
        title="Alarm Tuner"
        purpose="Replay candidate settings on trusted history and approve the best safe one."
        info={['Run replay tests up to 175 settings per alarm class on 6 hours of history.', 'Grey crosses would miss a real event, so they are rejected. The green star is the best safe setting.', 'Approving writes the setting to the live simulation immediately and records a Management-of-Change entry.']}
      />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <Segmented label="Alarm point class" value={sel} onChange={(v) => setSel(v)} options={[...TUNER_CLASSES.map((c) => ({ id: c.id as Sel, label: c.label })), { id: 'all' as Sel, label: 'All' }]} />
        <div className="row">
          <Toggle checked={gate} onChange={setGate} label={<>Trust gating <b>{gate ? 'ON' : 'OFF'}</b></>} />
          <Toggle checked={useLive} onChange={setUseLive} label="Add live recorded buffer" />
          <button className="btn" disabled={Object.keys(results).length === 0} onClick={() => tunerReport({ results, contam, clean, gate, hours: tsRef.current?.hours ?? 6, cfg: runner.sim.cfg, changes })}><FileText size={15} /> PDF report</button>
          <button className="btn tune big" onClick={run} disabled={busy}>
            <Play size={16} /> {busy ? 'Replaying…' : 'Run replay'}
          </button>
        </div>
      </div>

      <div className="tuner-grid">
        <Card title="Current settings" accent="tune">
          <div className="stack">
            {classes.map((c) => {
              const cur = settingOf(snap.cfg, c);
              return (
                <div key={c} className="setting-row">
                  <b>{metaOf(c).label}</b>
                  <span className="mono">{cur.limit.toFixed(2)} {metaOf(c).unit}</span>
                  <span className="mono muted">deadband {cur.deadband.toFixed(2)} · on-delay {cur.onDelay}s</span>
                </div>
              );
            })}
            <div className="hr" />
            <Kpi label="Live raw alarm rate (per 10 min)" value={snap.raw10} delta={preBase ? `was ${preBase.raw} when replay started` : undefined} />
            <Kpi label="Raw alarms in the last 60 s" value={snap.raw1m} delta="drops as soon as an approved setting takes effect" />
          </div>
        </Card>
        <Card title="Pareto chart" sub={`${metaOf(shown).label}: x = mean detection delay, y = alarms per 10 min`} accent="tune">
          {busy && (
            <div className="stack" role="status" aria-live="polite">
              <div className="replaying-timeline" aria-hidden>
                {Array.from({ length: 48 }, (_, i) => <i key={i} style={{ height: 10 + ((i * 37) % 28), opacity: i / 48 < progress ? 1 : 0.2 }} />)}
              </div>
              <div className="progress" aria-label="Replay progress"><i style={{ width: `${progress * 100}%` }} /></div>
              <span className="muted">Replaying candidate settings on stored data… {Math.round(progress * 100)}%</span>
            </div>
          )}
          {!busy && res && <ParetoChart candidates={res.candidates} current={res.current} />}
          {!busy && !res && <div className="empty"><b style={{ color: 'var(--text)' }}>No replay yet</b>Press “Run replay” to evaluate the candidate grid (&lt; 3 s).</div>}
          {res && !busy && <p className="muted" style={{ fontSize: 12 }}>Replay took {res.ms.toFixed(0)} ms for {res.candidates.length} candidates.</p>}
        </Card>
      </div>

      <div className="tuner-grid">
        <Card title="Recommendation" accent="tune">
          {classes.map((c) => {
            const r = results[c];
            const p = r?.proposal;
            return (
              <div key={c} className="reco">
                <b>{metaOf(c).label}</b>
                {!r && <span className="muted">Run the replay to get a recommendation.</span>}
                {r && !p && <span className="muted">No safer setting found: the current setting is already best on this history (honest result).</span>}
                {p && (
                  <>
                    <div className="mono" style={{ fontSize: 15 }}>
                      {p.old.limit.toFixed(2)} → <b>{p.new.limit.toFixed(2)}</b> {metaOf(c).unit} · db {p.old.deadband.toFixed(2)} → {p.new.deadband.toFixed(2)} · delay {p.old.onDelay}s → {p.new.onDelay}s
                    </div>
                    <div className="muted">{p.evidence}</div>
                    <ul className="checks">
                      <li><Check size={14} aria-hidden /> Missed events = 0 ✓</li>
                      <li><Check size={14} aria-hidden /> Mean delay increase ≤ 20 s ✓ ({p.stats.delayDelta >= 0 ? '+' : ''}{p.stats.delayDelta.toFixed(0)} s)</li>
                      <li><Check size={14} aria-hidden /> Trust-gated history ({gate ? 'ON' : 'OFF: contaminated!'})</li>
                    </ul>
                  </>
                )}
              </div>
            );
          })}
          <button className="btn primary big" disabled={proposals.length === 0} onClick={() => setConfirm(proposals)} style={{ marginTop: 10 }}>
            <ShieldCheck size={16} /> Approve &amp; write back
          </button>
        </Card>

        <Card title="Gated vs contaminated" sub="Both judged on clean data" accent="tune">
          {cmp.g && cmp.u ? (
            <div className="stack">
              <div className="cmp">
                <div>
                  <span className="badge trust">Trust-gated</span>
                  <b className="num big">{cmp.g.proposal ? cmp.g.proposal.new.limit.toFixed(2) : '–'}</b>
                  <span className="muted">{cmp.g.proposal?.evidence ?? 'no change'}</span>
                  <span className="muted">claimed false alarms/10 min: <b className="num">{cmp.g.current.falseAlarms.toFixed(2)}</b></span>
                </div>
                <div>
                  <span className="badge bad">Contaminated (ungated)</span>
                  <b className="num big">{cmp.u.proposal ? cmp.u.proposal.new.limit.toFixed(2) : '–'}</b>
                  <span className="muted">{cmp.u.proposal?.evidence ?? 'no change'}</span>
                  <span className="muted">claimed false alarms/10 min: <b className="num">{cmp.u.current.falseAlarms.toFixed(2)}</b></span>
                </div>
              </div>
              {clean[shown] ? (
                <div className={`note ${clean[shown]!.g < clean[shown]!.u - 1e-6 ? 'ok' : ''}`}>
                  Judged on clean (trusted) data, the objective J is <b>{clean[shown]!.g.toFixed(2)}</b> with {gate ? 'gating ON' : 'gating OFF'} vs <b>{clean[shown]!.u.toFixed(2)}</b> with {gate ? 'gating OFF' : 'gating ON'} (lower is better).
                  {clean[shown]!.g < clean[shown]!.u - 1e-6 ? ' Contamination made the recommendation worse.' : ' On this history the two recommendations coincide: honest result.'}
                </div>
              ) : (
                <p className="muted">One of the two runs found no better setting, so there is nothing to compare.</p>
              )}
            </div>
          ) : (
            <p className="muted">Run the replay to see how faulty-sensor samples (spikes, false drops, drift) contaminate tuning when gating is off.</p>
          )}
        </Card>
      </div>

      <Card title="Loop view: closed-loop improvement" sub="Scenario S8 re-run after each tuning round" accent="tune" actions={<button className="btn tune sm" onClick={runLoop} disabled={loopBusy}>{loopBusy ? 'Running…' : 'Run loop iterations'}</button>}>
        <div className="loop-view">
          <LoopDiagram size={240} />
          <div className="grow">
            {!loop && <p className="muted">{loopBusy ? 'Re-running the pipeline with each iteration’s approved settings…' : 'Press “Run loop iterations” to actually re-run scenario S8 with the settings the tuner approves at each step.'}</p>}
            {loop && <LoopBars items={loop} />}
          </div>
        </div>
      </Card>

      <Card title="Change log" sub="Management-of-Change records (persisted locally)" flush>
        <ChangeLog />
      </Card>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Approve and write back?" footer={<><button className="btn" onClick={() => setConfirm(null)}>Cancel</button><button className="btn primary" onClick={approve}>Approve &amp; apply to live simulation</button></>}>
        <p>The following simulated writes will be sent (dry run). The setting is applied to the live simulation immediately, a Management-of-Change record is created, and you can revert it later.</p>
        <div className="code">
          {(confirm ?? []).flatMap((p) => {
            const names: Record<string, string> = { ptLow: 'Low', ptHigh: 'High', roc: 'Roc', flowDev: 'FlowDev' };
            const tag = p.cls === 'flowDev' ? 'FT-out' : 'PT-n (all 12)';
            return [`ns=2;s=${tag}.AlarmCfg.${names[p.cls]}.Threshold = ${p.new.limit}`, `ns=2;s=${tag}.AlarmCfg.${names[p.cls]}.Deadband = ${p.new.deadband}`, `ns=2;s=${tag}.AlarmCfg.${names[p.cls]}.OnDelay = ${p.new.onDelay}`];
          }).join('\n')}
        </div>
        <p className="muted">DeltaTrace never issues control commands. This is an operator-approved alarm parameter change only.</p>
      </Modal>
      {void toast}
    </div>
  );
}

function LoopBars({ items }: { items: LoopIteration[] }) {
  const max = Math.max(...items.map((i) => i.raw), 1);
  return (
    <div className="loop-bars" role="img" aria-label={`Raw alarm load per iteration: ${items.map((i) => `iteration ${i.iteration}: ${i.raw}`).join(', ')}`}>
      {items.map((i) => (
        <div key={i.iteration} className="lb">
          <div className="lb-bar"><i style={{ height: `${(i.raw / max) * 100}%` }} /></div>
          <b className="num">{i.raw}</b>
          <span className="muted">iter {i.iteration}</span>
          <span className="muted" style={{ fontSize: 11 }}>peak {i.peak10}</span>
        </div>
      ))}
    </div>
  );
}
