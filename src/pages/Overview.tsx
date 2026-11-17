import { ArrowRight, PlayCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { SafetyRuleList } from '../components/domain/SafetyRules';
import { Card } from '../components/ui/Card';
import { Ticker } from '../components/ui/Ticker';
import { LoopDiagram } from '../components/viz/LoopDiagram';
import { useLogStore } from '../state/logStore';
import { useSimStore } from '../state/simStore';

function TrustIllustration() {
  return (
    <svg viewBox="0 0 120 70" width="120" height="70" role="img" aria-label="Three sensor trust bars filling">
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x="8" y={14 + i * 18} width="104" height="8" rx="1.5" fill="var(--bg-elev-3)" />
          <rect x="8" y={14 + i * 18} width="0" height="8" rx="1.5" fill="var(--c-trust)">
            <animate attributeName="width" values={`0;${[96, 78, 104][i]};${[96, 78, 104][i]};0`} keyTimes="0;0.5;0.85;1" dur="5s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
          </rect>
        </g>
      ))}
    </svg>
  );
}
function GroupIllustration() {
  const dots = [
    [14, 12],
    [30, 54],
    [50, 20],
    [22, 36],
    [44, 48],
  ];
  return (
    <svg viewBox="0 0 120 70" width="120" height="70" role="img" aria-label="Several alarm dots merging into one incident">
      {dots.map(([x, y], i) => (
        <circle key={i} r="5" fill="var(--c-group)">
          <animate attributeName="cx" values={`${x};95;95;${x}`} keyTimes="0;0.5;0.85;1" dur="5s" repeatCount="indefinite" />
          <animate attributeName="cy" values={`${y};35;35;${y}`} keyTimes="0;0.5;0.85;1" dur="5s" repeatCount="indefinite" />
        </circle>
      ))}
      <circle cx="95" cy="35" r="12" fill="none" stroke="var(--c-group)" strokeWidth="3">
        <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.4;0.55;0.85;1" dur="5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}
function TuneIllustration() {
  return (
    <svg viewBox="0 0 120 70" width="120" height="70" role="img" aria-label="A slider moving to a better setting">
      <rect x="10" y="32" width="100" height="6" rx="3" fill="var(--bg-elev-3)" />
      <rect x="10" y="32" width="50" height="6" rx="3" fill="var(--c-tune)">
        <animate attributeName="width" values="25;78;78;25" keyTimes="0;0.5;0.85;1" dur="5s" repeatCount="indefinite" />
      </rect>
      <circle cy="35" r="9" fill="var(--c-tune)" stroke="var(--bg-elev-1)" strokeWidth="3">
        <animate attributeName="cx" values="35;88;88;35" keyTimes="0;0.5;0.85;1" dur="5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

export default function Overview() {
  const snap = useSimStore((s) => s.snap)!;
  const nav = useNavigate();
  const changes = useLogStore((s) => s.changeLog);
  const good = snap.trust.filter((t) => t.cls === 'GOOD').length;
  const unc = snap.trust.filter((t) => t.cls === 'UNCERTAIN').length;
  const bad = snap.trust.filter((t) => t.cls === 'BAD').length;
  const last = changes.find((c) => c.status === 'Approved');
  const mainInc = [...snap.openIncidents, ...snap.recentClosed].sort((a, b) => b.alarmIds.length - a.alarmIds.length)[0];
  return (
    <div className="page">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <span className="badge neutral">200 km pipeline · live simulation</span>
          <h1 id="hero-title">Fewer alarms. Clearer incidents. Safer settings.</h1>
          <p>
            One pipeline event sends a pressure wave past many sensors and becomes dozens of alarms; some sensors also report wrong values. DeltaTrace runs beside the existing control system and adds three functions:
            <b> a trust score for every sensor</b>,
            <b> grouping of alarms by pressure-wave delay</b>, and
            <b> alarm settings tuned only on trusted data</b>.
          </p>
          <div className="row">
            <button className="btn primary big" onClick={() => nav('/console')}>Open Live Console <ArrowRight size={18} /></button>
            <button className="btn big" onClick={() => nav('/demo')}><PlayCircle size={18} /> Start Guided Demo</button>
          </div>
        </div>
      </section>

      <div className="three-col">
        <Card accent="trust" className="innov">
          <TrustIllustration />
          <h2>1 · Trust Engine</h2>
          <p className="muted">Live 0–1 score per sensor from neighbour agreement, mass balance, signal behaviour and communications.</p>
          <div className="live-line"><b className="num">{good}</b> sensors GOOD · <b className="num">{unc}</b> UNCERTAIN · <b className="num">{bad}</b> BAD</div>
          <Link to="/trust">Open Trust Center →</Link>
        </Card>
        <Card accent="group" className="innov">
          <GroupIllustration />
          <h2>2 · Delay-Based Grouping</h2>
          <p className="muted">Alarms whose time gaps fit the wave travel time join one incident. Incidents are classified and ranked; every raw alarm is kept.</p>
          <div className="live-line">{mainInc ? <><b className="num">{mainInc.alarmIds.length}</b> raw alarms → <b className="num">1</b> incident</> : <>Calm: <b className="num">{snap.rawTotal}</b> raw alarms so far</>}</div>
          <Link to="/incidents">Open Incidents →</Link>
        </Card>
        <Card accent="tune" className="innov">
          <TuneIllustration />
          <h2>3 · Trust-Gated Replay Tuner</h2>
          <p className="muted">Candidate settings are replayed on trusted history. The best safe setting is written back after operator approval.</p>
          <div className="live-line">{last ? <>Last tuning: <b>{last.point}</b> · {last.evidence.split(',')[0]}</> : <>No tuning approved yet</>}</div>
          <Link to="/tuner">Open Alarm Tuner →</Link>
        </Card>
      </div>

      <Card title="Live before / after" sub="Last 10 simulated minutes" accent="brand">
        <div className="before-after">
          <div className="ba-tile">
            <span className="muted">Raw alarms (last 10 min)</span>
            <Ticker className={`ba-num${snap.raw10 >= 10 ? ' bad' : ''}`} value={snap.raw10} />
            <div className="ba-bar" role="img" aria-label={`${snap.raw10} raw alarms; flood threshold 10`}>
              <i style={{ width: `${Math.min(100, (snap.raw10 / 30) * 100)}%`, background: snap.raw10 >= 10 ? 'var(--bad)' : 'var(--ok)' }} />
              <b style={{ left: `${(10 / 30) * 100}%` }} title="flood threshold: 10" />
            </div>
            <span className="muted" style={{ fontSize: 12 }}>flood threshold line at 10</span>
          </div>
          <ArrowRight size={34} aria-hidden style={{ color: 'var(--text-muted)' }} />
          <div className="ba-tile">
            <span className="muted">Operator items (last 10 min)</span>
            <Ticker className="ba-num ok" value={snap.op10} />
            <div className="ba-bar" role="img" aria-label={`${snap.op10} operator items`}>
              <i style={{ width: `${Math.min(100, (snap.op10 / 30) * 100)}%`, background: 'var(--c-group)' }} />
              <b style={{ left: `${(10 / 30) * 100}%` }} />
            </div>
            <span className="muted" style={{ fontSize: 12 }}>incidents + advisories</span>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>Inject a fault (<kbd>F</kbd>) to compare the two numbers.</p>
      </Card>

      <div className="two-col">
        <Card title="The closed loop" sub="Trust, grouping, labelled events, tuning, cleaner data">
          <div className="row" style={{ justifyContent: 'center' }}>
            <LoopDiagram size={330} />
          </div>
        </Card>
        <Card title="Safety first" sub="Enforced in code, checked live">
          <SafetyRuleList snap={snap} compact />
        </Card>
      </div>
    </div>
  );
}
