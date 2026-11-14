import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CHANNELS, DEFAULT_CONFIG, NODES, Simulation, delay, generateTraining, runLoopIterations, runTuner, type LoopIteration, type TunerResult } from '../engine';
import { SafetyRuleList } from '../components/domain/SafetyRules';
import { PageHeader } from '../components/shell/PageHeader';
import { TrustBadge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { ARCH_INFO, ArchitectureDiagram } from '../components/viz/ArchitectureDiagram';
import { DelayCone } from '../components/viz/DelayCone';
import { LoopDiagram } from '../components/viz/LoopDiagram';
import { ParetoChart } from '../components/viz/ParetoChart';
import { TrustGauge } from '../components/viz/TrustGauge';
import { runner } from '../state/runner';
import { useSimStore } from '../state/simStore';
import { Slider } from '../components/ui/Slider';
import { Segmented } from '../components/ui/Segmented';

const SECTIONS = [
  ['problem', 'The problem'],
  ['architecture', 'Architecture'],
  ['delay', 'Delay rule'],
  ['trust', '1 · Trust engine'],
  ['grouping', '2 · Grouping'],
  ['tuner', '3 · Replay tuner'],
  ['loop', 'Closed loop'],
  ['safety', 'Safety rules'],
  ['dataflow', 'Data flow per scan'],
  ['tech', 'Technology'],
  ['glossary', 'Glossary'],
  ['limits', 'Honest limits'],
] as const;

function Section({ id, title, lead, children }: { id: string; title: string; lead: string; children: ReactNode }) {
  return (
    <section id={id} className="hiw-section" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}>{title}</h2>
      <p className="lead">{lead}</p>
      {children}
    </section>
  );
}
const Alt = ({ children }: { children: ReactNode }) => <p className="sr-only">{children}</p>;

function ProblemAnim() {
  const nodes = Array.from({ length: 8 }, (_, i) => 50 + i * 80);
  return (
    <svg viewBox="0 0 700 150" width="100%" role="img" aria-label="Animation: one event sends a pressure wave past eight sensors, each raising an alarm, while one sensor lies">
      <rect x="30" y="68" width="640" height="14" rx="7" fill="var(--pipe)" />
      <g>
        <circle cx="330" cy="75" r="6" fill="var(--bad)" />
        {[0, 1].map((k) => (
          <ellipse key={k} cx="330" cy="75" rx="8" ry="26" fill="none" stroke="var(--info)" strokeWidth="2.5">
            <animate attributeName="rx" values="8;330" dur="6s" begin={`${k * 3}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0" dur="6s" begin={`${k * 3}s`} repeatCount="indefinite" />
          </ellipse>
        ))}
      </g>
      {nodes.map((x, i) => {
        const d = Math.abs(x - 330) / 330;
        return (
          <g key={x}>
            <circle cx={x} cy="75" r="7" fill="var(--bg-elev-1)" stroke="var(--text-muted)" strokeWidth="2" />
            <g opacity="0">
              <animate attributeName="opacity" values="0;0;1;1;0" keyTimes={`0;${0.05 + d * 0.5};${0.07 + d * 0.5};0.92;1`} dur="6s" repeatCount="indefinite" />
              <circle cx={x} cy="38" r="10" fill="var(--bad)" />
              <text x={x} y="42" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff">!</text>
            </g>
          </g>
        );
      })}
      <g>
        <text x="610" y="118" textAnchor="middle" fontSize="11" fill="var(--warn-ink)" fontWeight="700">lying sensor</text>
        <circle cx="610" cy="75" r="9" fill="var(--warn-soft)" stroke="var(--warn)" strokeWidth="3">
          <animate attributeName="r" values="7;11;7" dur="1s" repeatCount="indefinite" />
        </circle>
      </g>
      <text x="330" y="140" textAnchor="middle" fontSize="12" fill="var(--text-muted)">one event → a wave passes every sensor → many alarms</text>
    </svg>
  );
}

export default function HowItWorks() {
  const snap = useSimStore((s) => s.snap)!;
  const [active, setActive] = useState('problem');
  const [arch, setArch] = useState<string | null>('scada');
  const [c, setC] = useState(1000);
  const [gStep, setGStep] = useState(0);
  const [tStep, setTStep] = useState(0);
  const [tun, setTun] = useState<TunerResult | null>(null);
  const [tunBusy, setTunBusy] = useState(false);
  const [gateView, setGateView] = useState<'on' | 'off'>('on');
  const [tunOff, setTunOff] = useState<TunerResult | null>(null);
  const [loop, setLoop] = useState<LoopIteration[] | null>(null);
  const [loopBusy, setLoopBusy] = useState(false);
  const [cost, setCost] = useState<number | null>(null);
  const ch = 7;
  const st = snap.trust[ch];

  useEffect(() => {
    const els = SECTIONS.map(([id]) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: '-30% 0px -60% 0px' });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    const id = setInterval(() => setTStep((s) => (s + 1) % 8), 1400);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const sim = new Simulation(DEFAULT_CONFIG, 5);
    sim.injectFault({ type: 'pumpTrip', node: 4, delay: 20 });
    const t0 = performance.now();
    for (let i = 0; i < 300; i++) sim.step();
    setCost((performance.now() - t0) / 300);
  }, []);

  const conePoints = useMemo(() => {
    const trueC = 1000;
    const obs = (km: number, jitter = 0) => ({ km, t: (Math.abs(km - 80) * 1000) / trueC + jitter, label: `km ${km}` });
    return [obs(100, 2), obs(120, -1), obs(60, 3), obs(40, 1), obs(160, 4), { km: 200, t: 22, label: 'km 200 (far)' }];
  }, []);
  const refPt = { km: 80, t: 0, label: 'ref' };

  const runTune = async () => {
    setTunBusy(true);
    await new Promise((r) => setTimeout(r, 30));
    const ts = generateTraining();
    setTun(await runTuner(ts, 'roc', DEFAULT_CONFIG, { gate: true }));
    setTunOff(await runTuner(ts, 'roc', DEFAULT_CONFIG, { gate: false }));
    setTunBusy(false);
  };
  const runLoop = async () => {
    setLoopBusy(true);
    setLoop(await runLoopIterations(3, 19));
    setLoopBusy(false);
  };
  const live: Record<string, string> = {
    pipeline: `${snap.faults.filter((f) => f.started && f.kind === 'process').length} active process event(s)`,
    rtu: `${snap.trust.filter((t) => t.likelyFault === 'stale').length} stale channel(s)`,
    comm: `${snap.trust.filter((t) => t.c.C > 0).length} channel(s) with comms issues`,
    proto: '15 channels polled every second, scanned every 5 s',
    scada: `${snap.rawActive} active raw alarms · ${snap.rawTotal} total`,
    historian: `${Math.min(7200, Math.round(snap.t))} s of history held (ring buffer: 2 h)`,
    gps: `clock skew setting ±${snap.cfg.clockSkew} s`,
    console: snap.engineEnabled ? `${snap.openIncidents.length} open incident(s) shown` : 'FAIL-OPEN: raw alarms mirrored',
    gateway: 'read-only: 0 commands accepted from DeltaTrace',
    map: `wave speed ${snap.cfg.waveSpeed} m/s · hop limit ${snap.cfg.hopLimit}`,
    trust: `${snap.trust.filter((t) => t.cls === 'GOOD').length} GOOD · ${snap.trust.filter((t) => t.cls === 'UNCERTAIN').length} UNCERTAIN · ${snap.trust.filter((t) => t.cls === 'BAD').length} BAD`,
    group: `${snap.openIncidents.length} open · ${snap.advisories.length} advisories`,
    tuner: `${snap.cfg.alarms.roc.limit.toFixed(2)} bar/10 s current ROC limit`,
    audit: `${runner.sim.book.totalAudit} entries`,
    wb: `${runner.sim.book.totalWrites} dry-run writes`,
    wbif: 'control commands issued: 0',
  };
  const scanStages = [
    ['Sample', `${CHANNELS.length} channels`],
    ['SCADA alarms', `${snap.raw10} raw / 10 min`],
    ['Trust', `${snap.trust.filter((t) => t.cls !== 'GOOD').length} not GOOD`],
    ['Group & classify', `${snap.openIncidents.length} incidents open`],
    ['Safety rules', `${snap.criticalHidden} critical hidden`],
    ['Write-back', `${runner.sim.book.totalWrites} writes`],
    ['KPIs', `${snap.op10} items / 10 min`],
  ];
  const CONE_STEPS = ['1 · Alarms arrive on a position–time plot.', '2 · The allowed-delay cone is drawn from the first alarm.', '3 · Alarms inside the cone merge; the outsider does not.', '4 · Corroboration fills: neighbours agree.', '5 · Classify, rank, write back.'];
  const merged = conePoints.filter((p) => Math.abs(p.km - 80) <= 60 && p.t <= Math.abs(p.km - 80) * (1000 / c) + snap.cfg.clockTol && p.t >= -snap.cfg.clockTol).length;

  return (
    <div className="page hiw">
      <PageHeader title="How It Works" purpose="How the system works, with diagrams driven by the live simulation." info={['Scroll or use the sticky navigation.', 'Diagrams update live; try the sliders and buttons.', 'Every diagram has a text alternative for screen readers.']} />
      <nav className="hiw-nav" aria-label="Sections">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className={active === id ? 'on' : ''} aria-current={active === id ? 'true' : undefined} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>{label}</a>
        ))}
      </nav>

      <Section id="problem" title="The problem in 20 seconds" lead="A long pipeline is watched through sensors about every 20 km. The existing system reads them and raises an alarm whenever a reading crosses a limit. Two things go wrong.">
        <div className="two-col">
          <Card><ProblemAnim /><Alt>One event sends a pressure wave along the pipe. Each sensor in turn raises an alarm, so a single event produces many alarms. Separately, one sensor is lying.</Alt></Card>
          <Card>
            <ul className="plain">
              <li><b>One event, many alarms.</b> A leak or pump trip sends a pressure wave past many sensors, so dozens of alarms appear within minutes: an alarm flood.</li>
              <li><b>Some alarms are not real.</b> A sensor can freeze, drift, spike, replay old data, go offline or be tampered with.</li>
            </ul>
            <div className="row" style={{ marginTop: 12 }}>
              <span className="chip">Raw alarms so far <b>{snap.rawTotal}</b></span>
              <span className="chip">Operator items <b>{snap.opTotal}</b></span>
              <button className="btn sm primary" onClick={() => runner.inject({ type: 'pumpTrip', node: 4 })}>Inject a pump trip</button>
            </div>
          </Card>
        </div>
      </Section>

      <Section id="architecture" title="System architecture" lead="DeltaTrace sits beside the existing system: read-only in, controlled write-back out. Click any block.">
        <div className="two-col arch-layout">
          <Card flush><div className="arch-scroll" style={{ padding: 8 }}><ArchitectureDiagram selected={arch} onSelect={setArch} failOpen={!snap.engineEnabled} /></div></Card>
          <Card title={arch ? ARCH_INFO[arch] ? arch.toUpperCase() : '' : 'Select a block'}>
            {arch && ARCH_INFO[arch] ? (
              <div className="stack">
                <p><b>Role.</b> {ARCH_INFO[arch].role}</p>
                <p><b>Inputs.</b> {ARCH_INFO[arch].inputs}</p>
                <p><b>Outputs.</b> {ARCH_INFO[arch].outputs}</p>
                <div className="note"><b>Live state:</b> {live[arch]}</div>
              </div>
            ) : <p className="muted">Click a block in the diagram.</p>}
            <div className="hr" />
            <p className="muted" style={{ fontSize: 13 }}>The arrow from SCADA to the operator console is the <b>fail-open path</b>: if DeltaTrace is off or fails, raw alarms reach the console unchanged. The lock means DeltaTrace never issues control commands.</p>
          </Card>
        </div>
        <Alt>Architecture: field sensors and RTUs connect through communication links and industrial protocols to the central SCADA server, historian, GPS clock and operator console. A read-only gateway copies data into the DeltaTrace unit containing a pipeline map, trust engine, grouping and classification engine, replay tuner, audit log and write-back module. A write-back interface returns incidents, quality flags and approved settings to the central server. A fail-open bypass sends raw alarms straight to the operator console. DeltaTrace issues no control commands.</Alt>
      </Section>

      <Section id="delay" title="Pipeline map & the delay rule" lead="A pressure wave travels at about 1000 m/s, so the time between two alarms tells you whether they can come from the same event: delay = distance ÷ wave speed.">
        <div className="two-col">
          <Card title="Which alarms would merge?" sub="A wave starts at km 80. Move the assumed wave speed.">
            <Slider label="Assumed wave speed" value={c} min={400} max={1200} step={20} unit=" m/s" onChange={setC} />
            <DelayCone points={conePoints} anchor={refPt} c={c} tol={snap.cfg.clockTol + 5} />
            <p><b>{merged}</b> of {conePoints.length} alarms fall inside the allowed cone and would merge. The alarm at km 200 is far outside.</p>
            <Alt>Position–time plot with a cone showing which alarms are close enough in time to share an incident. Slower wave speeds make the cone wider.</Alt>
          </Card>
          <Card title="Delays between neighbouring sensors">
            <div className="table-wrap"><table className="tbl" aria-label="Delays between neighbouring sensors">
              <thead><tr><th>Pair</th><th className="r">Distance</th><th className="r">Delay at {c} m/s</th><th className="r">Window (+{snap.cfg.clockTol + 5} s)</th></tr></thead>
              <tbody>
                {[[3, 4], [4, 5], [9, 10], [2, 6], [1, 9]].map(([a, b]) => (
                  <tr key={a + '-' + b}><td>{NODES[a].name} → {NODES[b].name}</td><td className="r num">{Math.abs(NODES[a].km - NODES[b].km)} km</td><td className="r num">{delay(a, b, c).toFixed(0)} s</td><td className="r num">≤ {(delay(a, b, c) + snap.cfg.clockTol + 5).toFixed(0)} s</td></tr>
                ))}
              </tbody>
            </table></div>
            <p className="muted" style={{ marginTop: 8 }}>20 km ÷ 1000 m/s = 20 s. Alarms more than {snap.cfg.hopLimit} hops apart are never merged, however close in time.</p>
          </Card>
        </div>
      </Section>

      <Section id="trust" title="Innovation 1 · Trust engine" lead="Four checks feed one live trust score between 0 and 1. Break the sensor below and watch the score move.">
        <div className="two-col">
          <Card accent="trust" title={`Live example: ${CHANNELS[ch].tag}`}>
            <div className="trust-cards">
              {[
                ['Neighbour residual', `z = ${st.c.z.toFixed(2)}`, Math.min(1, st.c.z ** 2 / 16)],
                ['Mass balance', `M = ${st.c.M.toFixed(2)}`, Math.min(1, st.c.M / 3)],
                ['Signal behaviour', `S = ${st.c.S.toFixed(2)}`, Math.min(1, st.c.S / 3)],
                ['Communication', `C = ${st.c.C.toFixed(2)}`, Math.min(1, st.c.C / 4)],
              ].map(([n, v, p]) => (
                <div key={String(n)} className="tc">
                  <b>{n}</b>
                  <span className="mono">{v}</span>
                  <span className="bar"><i style={{ width: `${Math.max(3, Number(p) * 100)}%`, background: Number(p) > 0.4 ? 'var(--bad)' : 'var(--c-trust)' }} /></span>
                </div>
              ))}
              <div className="tc-arrow" aria-hidden>→</div>
              <div className="tc gauge"><TrustGauge value={st.T} cls={st.cls} size={96} /><TrustBadge cls={st.cls} />{st.likelyFault && st.cls !== 'GOOD' && <span className="badge neutral">{st.likelyFault}</span>}</div>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              {(['stuck', 'replay', 'spike', 'drift', 'comms'] as const).map((f) => <button key={f} className="btn sm" onClick={() => runner.inject({ type: f, channel: ch })}>Break: {f}</button>)}
              <button className="btn sm primary" onClick={() => snap.faults.filter((f) => f.channels.includes(ch)).forEach((f) => runner.clearFault(f.id))}>Fix it</button>
            </div>
            <Alt>Four animated cards (neighbour residual, mass balance, signal behaviour, communication) feed one trust gauge for sensor PT-7. Current trust {st.T.toFixed(2)}, class {st.cls}.</Alt>
          </Card>
          <Card title="The formula, with live numbers">
            <div className="code">{`T = exp(−(λr·z² + λs·S + λc·C + λm·M))\n  = exp(−(${snap.cfg.lambdaR}·${st.c.z.toFixed(2)}² + ${snap.cfg.lambdaS}·${st.c.S.toFixed(2)} + ${snap.cfg.lambdaC}·${st.c.C.toFixed(2)} + ${snap.cfg.lambdaM}·${st.c.M.toFixed(2)}))\n  = ${st.Traw.toFixed(3)}  → smoothed  T = ${st.T.toFixed(3)}`}</div>
            <div className="hyst" aria-label="Trust classes with hysteresis">
              <div className="hs good">GOOD ≥ {snap.cfg.goodThreshold}</div>
              <div className="hs unc">UNCERTAIN {snap.cfg.badThreshold}–{snap.cfg.goodThreshold}</div>
              <div className="hs bad">BAD &lt; {snap.cfg.badThreshold}</div>
            </div>
            <p className="muted">Hysteresis: once BAD, a sensor must reach T ≥ 0.55 for three scans in a row before it can leave BAD, so the status does not flicker. During a real event, neighbours move together; the engine widens its tolerance instead of punishing the healthy sensors.</p>
          </Card>
        </div>
      </Section>

      <Section id="grouping" title="Innovation 2 · Delay-based incident grouping" lead="Step through how alarms become one ranked, explained incident. Nothing is ever deleted.">
        <div className="two-col">
          <Card accent="group" title="Step-through" actions={<Segmented label="Step" value={gStep} onChange={setGStep} options={CONE_STEPS.map((_, i) => ({ id: i, label: String(i + 1) }))} />}>
            <p style={{ minHeight: 24 }}><b>{CONE_STEPS[gStep]}</b></p>
            <DelayCone points={gStep >= 0 ? conePoints.slice(0, gStep === 0 ? 3 : conePoints.length) : []} anchor={gStep >= 1 ? refPt : null} c={1000} tol={snap.cfg.clockTol + 5} />
            <div style={{ marginTop: 8 }}>
              <span className="muted">Corroboration</span>
              <div className="bar" style={{ height: 10 }}><i style={{ width: gStep >= 3 ? '88%' : '10%', background: 'var(--c-group)' }} /></div>
            </div>
            <Alt>A position–time plot showing alarms arriving, the allowed-delay cone, alarms inside merging, a far outlier not merging, and a corroboration bar filling.</Alt>
          </Card>
          <div className="stack">
            <Card title="Classification: first match wins">
              <ol className="tree">
                <li><b>Data-integrity anomaly</b> if ≥ 2 channels are stale/BAD with a comms cause, or a channel replays or flat-lines while neighbours change.</li>
                <li><b>Process event</b> if mean trust-weighted corroboration ≥ {snap.cfg.corrProcess}.</li>
                <li><b>Instrument fault</b> if confined to one channel (or BAD-trust channels) and corroboration &lt; {snap.cfg.corrFault}.</li>
                <li><b>Needs review</b> otherwise.</li>
              </ol>
            </Card>
            <Card title="Protected-alarm rules" accent="bad">
              <ul className="plain">
                <li>A safety-critical alarm always leads the incident headline.</li>
                <li>An alarm becomes an advisory only if trust &lt; {snap.cfg.demoteTrust} <b>and</b> corroboration &lt; {snap.cfg.demoteCorr} <b>and</b> it is not safety-critical.</li>
                <li>Every raw alarm stays linked to its incident or advisory.</li>
              </ul>
            </Card>
            <Card title="Why alarms 150 km apart are not merged">
              <p>Two simultaneous alarms 150 km apart are 7+ hops away and a wave needs 150 s to cross that distance. They cannot share one cause within the window, so they stay separate. A fixed 60 s window would merge them.</p>
            </Card>
          </div>
        </div>
      </Section>

      <Section id="tuner" title="Innovation 3 · Trust-gated replay tuner" lead="Alarm limits are set by hand and drift back toward flooding. The tuner tests candidates on stored data and proposes the best safe setting.">
        <Card accent="tune">
          <div className="pipeline-steps" role="list" aria-label="Tuner steps">
            {['Stored data', 'Trust gate', 'Candidates', 'Replay', 'Measure', 'Reject / select', 'Approve', 'Write back'].map((s, k) => (
              <div key={s} role="listitem" className={`ps${k === tStep ? ' on' : ''}${k < tStep ? ' done' : ''}`}><span>{k + 1}</span>{s}</div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn tune" onClick={runTune} disabled={tunBusy}>{tunBusy ? 'Replaying…' : 'Run on real simulated history'}</button>
            <Segmented label="Gating" value={gateView} onChange={setGateView} options={[{ id: 'on', label: 'Gating ON' }, { id: 'off', label: 'Gating OFF' }]} />
          </div>
          {(gateView === 'on' ? tun : tunOff) && <ParetoChart candidates={(gateView === 'on' ? tun : tunOff)!.candidates} current={(gateView === 'on' ? tun : tunOff)!.current} height={300} />}
          {tun && tunOff && <p className="muted">Gating ON claims {tun.current.falseAlarms.toFixed(2)} false alarms/10 min at the current setting; gating OFF sees {tunOff.current.falseAlarms.toFixed(2)} because faulty sensors pollute the data. That contamination is what trust gating removes.</p>}
          <Alt>Eight-step animated pipeline: stored data, trust gate, candidates, replay, measure, reject or select, approve, write back. A Pareto scatter plot shows candidate settings with the best safe setting starred.</Alt>
        </Card>
      </Section>

      <Section id="loop" title="The closed loop" lead="Trust → grouping → labelled events → tuning → fewer false alarms → cleaner data → better trust.">
        <div className="two-col">
          <Card><div className="row" style={{ justifyContent: 'center' }}><LoopDiagram size={340} /></div><Alt>A triangle of three nodes: trust, grouping and tuning, with arrows flowing around the loop.</Alt></Card>
          <Card title="Alarm load per iteration" actions={<button className="btn sm tune" onClick={runLoop} disabled={loopBusy}>{loopBusy ? 'Running…' : 'Run 3 iterations'}</button>}>
            {!loop && <p className="muted">Press the button to re-run the mixed-stress scenario with each round of approved settings.</p>}
            {loop && (
              <div className="loop-bars" role="img" aria-label={`Raw alarms per iteration: ${loop.map((i) => i.raw).join(', ')}`}>
                {loop.map((i) => (
                  <div key={i.iteration} className="lb"><div className="lb-bar"><i style={{ height: `${(i.raw / Math.max(...loop.map((x) => x.raw))) * 100}%` }} /></div><b className="num">{i.raw}</b><span className="muted">iter {i.iteration}</span></div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </Section>

      <Section id="safety" title="Safety rules" lead="Six rules, enforced in code and checked live.">
        <Card><SafetyRuleList snap={snap} /></Card>
      </Section>

      <Section id="dataflow" title="Data flow per scan" lead="Every 5 simulated seconds the engine runs one scan, in this order.">
        <Card>
          <div className="scan-flow" role="list" aria-label="Stages of one scan">
            <div className="scan-pulse" aria-hidden />
            {scanStages.map(([n, v], k) => (
              <div key={n} role="listitem" className="stage"><span className="n">{k + 1}</span><b>{n}</b><span className="mono muted">{v}</span></div>
            ))}
          </div>
          <p className="muted" style={{ marginTop: 10 }}>Measured here: about <b>{cost === null ? '…' : cost.toFixed(2)} ms</b> of engine time per simulated second on this device (12 nodes, 15 channels). Alarms in this scan window: {snap.raw10}; incidents out: {snap.openIncidents.length}; writes issued so far: {runner.sim.book.totalWrites}.</p>
          <Alt>Seven stages in order: sample, SCADA alarms, trust, group and classify, safety rules, write-back, KPIs, with live counts.</Alt>
        </Card>
      </Section>

      <Section id="tech" title="Technology & deployment" lead="The demo is a static website; a real deployment would look different.">
        <div className="two-col">
          <Card title="How this demo works">
            <ul className="plain">
              <li>Vite + React 18 + TypeScript (strict), hand-written SVG and canvas for every live visual.</li>
              <li>A pure, seeded TypeScript engine simulates hydraulics, sensor faults, SCADA alarms and the three innovations in your browser.</li>
              <li>No backend, no network calls, no accounts: it works offline.</li>
            </ul>
          </Card>
          <Card title="What would change in a real deployment">
            <ul className="plain">
              <li>A read-only data gateway (data diode) feeding DeltaTrace from the historian and SCADA.</li>
              <li>Standard protocols (OPC UA, DNP3, IEC 60870-5-104, Modbus) instead of a simulator.</li>
              <li>On-premise or cloud hosting, per the operator’s security policy.</li>
              <li>A management-of-change workflow around every parameter write.</li>
              <li>Field calibration of weights, wave speed and thresholds.</li>
            </ul>
          </Card>
        </div>
      </Section>

      <Section id="glossary" title="Glossary" lead="Words used in this app.">
        <Card>
          <dl className="glossary">
            {[
              ['Alarm flood', 'More than 10 alarms in 10 minutes: more than an operator can handle.'],
              ['RTU', 'Remote terminal unit: field device that samples sensors and talks to the control centre.'],
              ['SCADA', 'The existing control system that reads sensors, shows dashboards and raises alarms.'],
              ['Historian', 'Database of past sensor values.'],
              ['Deadband', 'How far a value must return before an alarm clears; prevents chattering.'],
              ['On-delay', 'How long a condition must last before the alarm is raised.'],
              ['Corroboration', 'Whether neighbouring sensors, within the expected delay, also see the event.'],
              ['Hysteresis', 'Different enter and leave thresholds, so a status does not flicker.'],
              ['MOC', 'Management of change: the record and approval around a settings change.'],
              ['Fail-open', 'If the helper fails or is switched off, the original alarms pass through unchanged.'],
            ].map(([t, d]) => (<div key={t}><dt>{t}</dt><dd>{d}</dd></div>))}
          </dl>
        </Card>
      </Section>

      <Section id="limits" title="Honest limits" lead="What this demo does not prove.">
        <Card accent="bad">
          <ul className="plain">
            <li><b>Simulated data.</b> Nothing here is field data or a validated safety product.</li>
            <li><b>Weights need field calibration.</b> The trust weights and thresholds are sensible defaults, not tuned to a real line.</li>
            <li><b>Wave speed must be known or estimated.</b> A wrong value shifts every delay window.</li>
            <li><b>The origin estimate is a grouping aid</b>, not a leak locator.</li>
            <li><b>Overlapping events merge.</b> Two events close in time and place can end up in one incident.</li>
            <li><b>Operator approval is always required</b> for any setting change.</li>
          </ul>
        </Card>
      </Section>
    </div>
  );
}
