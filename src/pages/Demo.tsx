import { Check, ChevronLeft, ChevronRight, Pause, Play, Presentation, RotateCcw, ShieldAlert, SkipForward } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generateTraining, runTuner, evaluateSetting, settingOf, type TunerResult } from '../engine';
import { QUICK_FAULTS } from '../components/domain/FaultInjector';
import { SafetyRuleList } from '../components/domain/SafetyRules';
import { PageHeader } from '../components/shell/PageHeader';
import { Card } from '../components/ui/Card';
import { Kpi } from '../components/ui/Kpi';
import { LoopDiagram } from '../components/viz/LoopDiagram';
import { ParetoChart } from '../components/viz/ParetoChart';
import { runner } from '../state/runner';
import { useSimStore } from '../state/simStore';
import { useUiStore } from '../state/uiStore';
import Console from './Console';

type Focus = 'schematic' | 'raw' | 'dt' | 'charts' | 'tuner' | 'summary';
interface Step {
  title: string;
  caption: string;
  focus: Focus;
  seconds: number;
  enter: () => void | (() => void);
}

export default function Demo() {
  const snap = useSimStore((s) => s.snap)!;
  const speed = useSimStore((s) => s.speed);
  const presenter = useUiStore((s) => s.presenter);
  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  const [left, setLeft] = useState(0);
  const [tune, setTune] = useState<{ phase: 'idle' | 'running' | 'gated' | 'compare' | 'approved'; res?: TunerResult; contam?: TunerResult; clean?: { g: number; u: number }; before?: number }>({ phase: 'idle' });
  const cleanup = useRef<void | (() => void)>(undefined);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms / Math.max(1, useSimStore.getState().speed)));
  };

  const runTuning = useCallback(async () => {
    setTune({ phase: 'running', before: runner.sim.raw10 });
    await new Promise((r) => setTimeout(r, 400));
    const ts = generateTraining();
    const cfg = runner.sim.cfg;
    const g = await runTuner(ts, 'roc', cfg, { gate: true });
    setTune((t) => ({ ...t, phase: 'gated', res: g }));
    later(async () => {
      const u = await runTuner(ts, 'roc', cfg, { gate: false });
      const cur = settingOf(cfg, 'roc');
      const clean = g.proposal && u.proposal ? { g: evaluateSetting(ts, 'roc', cfg, g.proposal.new, cur).J, u: evaluateSetting(ts, 'roc', cfg, u.proposal.new, cur).J } : undefined;
      setTune((t) => ({ ...t, phase: 'compare', contam: u, clean }));
    }, 7000);
    later(() => {
      if (g.proposal) runner.approve(g.proposal);
      setTune((t) => ({ ...t, phase: 'approved' }));
    }, 15000);
  }, []);

  const steps = useMemo<Step[]>(
    () => [
      { title: 'Normal operation', caption: 'A 200 km pipeline. Sensors every 20 km. All trusted.', focus: 'schematic', seconds: 30, enter: () => { runner.reset(7); useUiStore.getState().set({ explain: false, selectedIncident: null }); } },
      { title: 'The problem', caption: 'One event. Dozens of alarms.', focus: 'raw', seconds: 40, enter: () => { runner.clearAll(); runner.inject({ type: 'pumpTrip', node: 4 }); } },
      { title: 'Delay-based grouping', caption: 'Alarms are grouped when their time gaps fit distance ÷ wave speed. Two simultaneous alarms 150 km apart are NOT merged.', focus: 'dt', seconds: 45, enter: () => { useUiStore.getState().set({ explain: true }); runner.inject({ type: 'falseDrop', channel: 10, duration: 100, delay: 30 }); } },
      { title: 'A leak', caption: 'The origin estimate lands near km 87: a grouping aid, not a leak locator.', focus: 'schematic', seconds: 45, enter: () => { runner.clearAll(); runner.inject({ type: 'leak', km: 87, size: 'medium' }); } },
      { title: 'A lying sensor', caption: 'PT-7 freezes. Its trust ring goes amber, then red; its alarm becomes an advisory. Nothing is hidden.', focus: 'dt', seconds: 45, enter: () => { runner.clearAll(); useUiStore.getState().set({ explain: false }); runner.inject({ type: 'stuck', channel: 7 }); } },
      { title: 'Spoof + real event', caption: 'PT-3 replays old data while a real valve closes at N5: a data-integrity incident and a process event, correctly separated.', focus: 'dt', seconds: 55, enter: () => { runner.clearAll(); runner.inject({ type: 'replay', channel: 3 }); runner.inject({ type: 'valveClosure', node: 5, size: 'medium', delay: 230 }); } },
      { title: 'Comms outage + leak', caption: 'Three RTUs go dark while a leak starts at km 40: two separate incidents.', focus: 'dt', seconds: 60, enter: () => { runner.clearAll(); for (const s of QUICK_FAULTS[6].specs) runner.inject(s); } },
      { title: 'Tuning', caption: 'Replay candidate settings on trusted data, see the Pareto front, watch contamination hurt, approve the best safe setting.', focus: 'tuner', seconds: 30, enter: () => { runner.clearAll(); runner.inject({ type: 'pumpTrip', node: 4, duration: 90 }); void runTuning(); } },
      { title: 'Fail-open', caption: 'Engine OFF: the right panel mirrors the raw alarms. Switch it back ON and incidents return.', focus: 'dt', seconds: 30, enter: () => { runner.clearAll(); runner.inject({ type: 'valveClosure', node: 6, size: 'large', duration: 120 }); later(() => runner.setConfig({ engineEnabled: false }), 5000); later(() => runner.setConfig({ engineEnabled: true }), 20000); return () => runner.setConfig({ engineEnabled: true }); } },
      { title: 'Close the loop', caption: 'Trust → grouping → labelled events → tuning → fewer false alarms → cleaner data → better trust. Critical alarms hidden: 0.', focus: 'summary', seconds: 40, enter: () => { runner.clearAll(); } },
    ],
    [runTuning],
  );
  const stepRef = useRef(steps);
  stepRef.current = steps;

  const go = useCallback((n: number) => {
    const idx = Math.max(0, Math.min(stepRef.current.length - 1, n));
    if (typeof cleanup.current === 'function') cleanup.current();
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setTune({ phase: 'idle' });
    setI(idx);
    setLeft(stepRef.current[idx].seconds);
    cleanup.current = stepRef.current[idx].enter();
  }, []);

  useEffect(() => {
    if (!started) return;
    const id = window.setInterval(() => {
      if (!auto) return;
      setLeft((l) => {
        if (l <= 1) {
          if (i < stepRef.current.length - 1) setTimeout(() => go(i + 1), 0);
          return 0;
        }
        return l - 1;
      });
    }, 1000 / Math.max(1, speed));
    return () => clearInterval(id);
  }, [started, auto, i, go, speed]);
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      if (typeof cleanup.current === 'function') cleanup.current();
    },
    [],
  );

  const step = steps[i];
  const start = () => {
    setStarted(true);
    go(0);
  };
  return (
    <div className={`page demo demo-focus-${started ? step.focus : 'none'}${presenter ? ' presenter-mode' : ''}`}>
      <PageHeader
        title="Guided Demo"
        purpose="Ten-step walkthrough (about 7 minutes). P: presenter mode, R: emergency reset."
        info={['The demo drives the real Live Console below.', 'Auto-play advances every step; use the arrows to go back or skip.', 'Presenter mode hides the sidebar and enlarges text.']}
        actions={
          <>
            <button className={`btn${presenter ? ' primary' : ''}`} onClick={() => useUiStore.getState().set({ presenter: !presenter })} aria-pressed={presenter}><Presentation size={15} /> Presenter mode <kbd>P</kbd></button>
            <button className="btn danger" onClick={() => runner.emergencyReset()}><ShieldAlert size={15} /> Emergency reset <kbd>R</kbd></button>
          </>
        }
      />

      <Card className="stepper-card" label="Demo stepper">
        {!started ? (
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: 20 }}>Ready to present?</h2>
              <p className="muted">Starting resets the simulation to a clean seed and runs all ten steps automatically (~7 minutes).</p>
            </div>
            <button className="btn primary big" onClick={start}><Play size={18} /> Start guided demo</button>
          </div>
        ) : (
          <div className="stack">
            <ol className="steps" aria-label="Demo steps">
              {steps.map((s, k) => (
                <li key={s.title}>
                  <button className={`step${k === i ? ' on' : ''}${k < i ? ' done' : ''}`} onClick={() => go(k)} aria-current={k === i ? 'step' : undefined} title={s.title}>
                    <span className="n">{k < i ? <Check size={12} /> : k + 1}</span>
                    <span className="t">{s.title}</span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="row">
              <button className="btn" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous step"><ChevronLeft size={16} /></button>
              <button className="btn" onClick={() => setAuto((a) => !a)} aria-pressed={auto}>{auto ? <Pause size={15} /> : <Play size={15} />} {auto ? 'Auto-play on' : 'Auto-play off'}</button>
              <button className="btn" onClick={() => go(i + 1)} disabled={i === steps.length - 1} aria-label="Next step"><SkipForward size={15} /> Skip</button>
              <button className="btn" onClick={() => go(i + 1)} disabled={i === steps.length - 1} aria-label="Next step"><ChevronRight size={16} /></button>
              <button className="btn" onClick={start}><RotateCcw size={15} /> Restart</button>
              <span className="grow" />
              <span className="mono muted">step {i + 1}/{steps.length} · next in {left}s</span>
            </div>
            <div className="progress" aria-hidden><i style={{ width: `${(1 - left / step.seconds) * 100}%` }} /></div>
          </div>
        )}
      </Card>

      {started && (
        <div className="demo-caption" role="status" aria-live="polite">
          <span className="badge group">Step {i + 1} · {step.title}</span>
          <p>{step.caption}</p>
          {presenter && <span className="countdown mono">{left}s</span>}
        </div>
      )}

      <Console embedded />

      {started && (step.focus === 'tuner' || tune.phase !== 'idle') && (
        <Card title="Tuning in the demo" sub="Replay, Pareto front, gating check, approval" accent="tune" className="demo-tuner">
          <div className="two-col">
            <div>
              {tune.phase === 'running' && <p role="status">Replaying 175 candidates on 6 hours of trusted history…</p>}
              {tune.res && <ParetoChart candidates={tune.res.candidates} current={tune.res.current} height={280} />}
            </div>
            <div className="stack">
              {tune.res?.proposal && <div className="note ok"><b>Recommendation:</b> rate-of-change limit {tune.res.proposal.old.limit.toFixed(2)} → <b>{tune.res.proposal.new.limit.toFixed(2)}</b> bar/10 s. {tune.res.proposal.evidence}.</div>}
              {tune.phase !== 'gated' && tune.phase !== 'running' && tune.phase !== 'idle' && tune.clean && (
                <div className="note warn"><b>Without trust gating</b> the same replay is contaminated by faulty sensors. Judged on clean data, its recommendation scores J = {tune.clean.u.toFixed(2)} vs {tune.clean.g.toFixed(2)} (lower is better).</div>
              )}
              {tune.phase === 'approved' && <div className="note ok"><b>Approved and written back.</b> Management-of-Change record created. Raw alarm rate: <b className="num">{tune.before}</b> → <b className="num">{snap.raw10}</b> per 10 min (live).</div>}
              <Kpi label="Live raw alarms / 10 min" value={snap.raw10} />
              <Kpi label="Raw alarms in the last 60 s" value={snap.raw1m} />
            </div>
          </div>
        </Card>
      )}

      {started && step.focus === 'summary' && (
        <Card title="Summary" accent="brand" className="demo-summary">
          <div className="two-col">
            <div className="row" style={{ justifyContent: 'center' }}><LoopDiagram size={300} /></div>
            <div className="stack">
              <div className="three-col" style={{ gap: 8 }}>
                <Kpi label="Raw alarms (this run)" value={snap.rawTotal} />
                <Kpi label="Operator items" value={snap.opTotal} />
                <Kpi label="Critical alarms hidden" value={snap.criticalHidden} tone={snap.criticalHidden ? 'bad' : 'ok'} />
              </div>
              <SafetyRuleList snap={snap} compact />
            </div>
          </div>
        </Card>
      )}

    </div>
  );
}
