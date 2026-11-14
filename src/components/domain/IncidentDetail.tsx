import { CheckCheck, FileText, Search, ThumbsDown, Wrench, Hammer } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CHANNELS, type Disposition, type Incident } from '../../engine';
import { runner } from '../../state/runner';
import { useLogStore } from '../../state/logStore';
import { alarmId, fmt, incId, mmss } from '../../utils/format';
import { incidentReport } from '../../utils/reports';
import { ClassBadge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { Table } from '../ui/Table';
import { IncidentTimeline } from '../viz/IncidentTimeline';

const DISP: { id: Disposition; label: string; icon: JSX.Element }[] = [
  { id: 'confirmed', label: 'Confirm process event', icon: <CheckCheck size={14} /> },
  { id: 'false-alarm', label: 'Mark false alarm', icon: <ThumbsDown size={14} /> },
  { id: 'instrument-fault', label: 'Mark instrument fault', icon: <Wrench size={14} /> },
  { id: 'needs-maintenance', label: 'Needs maintenance', icon: <Hammer size={14} /> },
];

export function IncidentDetail({ inc, compact }: { inc: Incident; compact?: boolean }) {
  const sim = runner.sim;
  const disposition = useLogStore((s) => s.dispositions[inc.id]) ?? inc.disposition;
  const alarms = useMemo(() => inc.alarmIds.map((id) => sim.agg.alarms.get(id)!).filter(Boolean), [inc.alarmIds.length, inc.id, sim]);
  const cfg = sim.cfg;
  const base = `ns=2;s=DeltaTrace.Incident.${String(inc.id).padStart(3, '0')}`;
  const writes = [
    `${base}.Class = "${inc.cls}"`,
    `${base}.Rank = ${inc.rank}`,
    ...(inc.origin ? [`${base}.Origin_km = ${inc.origin.km.toFixed(1)}`] : []),
    `${base}.MemberCount = ${inc.alarmIds.length}`,
    `${base}.Status = "${inc.status}"`,
  ];
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div>
        <div className="row" style={{ marginBottom: 6 }}>
          <b className="mono" style={{ fontSize: 18 }}>{incId(inc.id)}</b>
          <ClassBadge cls={inc.cls} provisional={inc.provisional} />
          <span className={`badge ${inc.status === 'open' ? 'ok' : 'neutral'}`}>{inc.status}</span>
          {inc.critical && <span className="badge bad">CRITICAL ALARM LEADS</span>}
          {disposition && <span className="badge trust">operator: {disposition.replace('-', ' ')}</span>}
          <span className="grow" />
          <button className="btn sm" onClick={() => incidentReport(inc, alarms, cfg)}><FileText size={13} /> PDF</button>
        </div>
        <p style={{ fontSize: 15, lineHeight: 1.45 }}>{inc.summary}</p>
      </div>

      <Card title="Why this class?" accent="group">
        <ul className="why">
          {inc.classReasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
          <li>
            Corroboration <b className="num">{inc.corroboration.toFixed(2)}</b> (process ≥ {cfg.corrProcess}, fault &lt; {cfg.corrFault}); mean trust <b className="num">{inc.meanTrust.toFixed(2)}</b>
          </li>
        </ul>
      </Card>

      {!compact && (
        <Card title="Timeline: position vs time" sub="Dashed: expected wavefront. Ringed: outlier. Square: mass balance. Grey: repeats." accent="group">
          <IncidentTimeline incident={inc} alarms={alarms} c={cfg.waveSpeed} tol={cfg.clockTol} />
        </Card>
      )}

      <Card title={`Member alarms (${alarms.length})`} sub="All raw alarms retained" actions={<Link to="/console" className="btn sm ghost">Show in raw log</Link>} flush>
        <Table
          label="Member alarms"
          maxHeight={compact ? 220 : 300}
          rows={alarms}
          rowKey={(a) => a.id}
          columns={[
            { key: 'id', header: 'ID', render: (a) => <span className="mono">{alarmId(a.id)}</span> },
            { key: 'tag', header: 'Tag', render: (a) => <b className="mono">{a.tag}</b>, sort: (a, b) => a.ch - b.ch },
            { key: 'type', header: 'Type', render: (a) => a.type },
            { key: 't', header: 'Time', render: (a) => <span className="mono">{mmss(a.time)}</span>, sort: (a, b) => a.time - b.time },
            { key: 'role', header: 'Role', render: (a) => <span className={`badge ${a.role === 'headline' ? 'group' : 'neutral'}`}>{a.role ?? 'member'}{a.safetyCritical ? ' · critical' : ''}</span> },
          ]}
        />
      </Card>

      {inc.origin && (
        <Card title="Origin estimate" sub="Grouping aid, not a leak locator" accent="group">
          <div className="row" style={{ gap: 20 }}>
            <div>
              <div className="kpi-big">km {fmt(inc.origin.km, 1)}</div>
              <div className="muted">± {fmt((inc.origin.hi - inc.origin.lo) / 2, 1)} km (range {fmt(inc.origin.lo, 1)}–{fmt(inc.origin.hi, 1)}) · residual {fmt(inc.origin.residual, 1)} s</div>
            </div>
            <ResidualCurve curve={inc.origin.curve} best={inc.origin.km} />
          </div>
        </Card>
      )}

      <Card title="Operator disposition" sub="Stored as a label; feeds the tuner and the loop view">
        <div className="row">
          {DISP.map((d) => (
            <button key={d.id} className={`btn sm${disposition === d.id ? ' primary' : ''}`} onClick={() => runner.disposition(inc.id, d.id)} aria-pressed={disposition === d.id}>
              {d.icon} {d.label}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Write-back preview" sub="Simulated tag writes for this incident (dry run)">
        <div className="code">{writes.join('\n')}</div>
      </Card>
      <p className="muted" style={{ fontSize: 12 }}>
        <Search size={12} style={{ verticalAlign: -1 }} aria-hidden /> Channels involved: {inc.channels.map((c) => CHANNELS[c].tag).join(', ') || '–'}
      </p>
    </div>
  );
}

function ResidualCurve({ curve, best }: { curve: { km: number; cost: number }[]; best: number }) {
  const W = 260;
  const H = 70;
  const pts = curve.map((p) => `${(p.km / 200) * W},${H - 4 - (1 - Math.min(1, p.cost * 4)) * (H - 10) * 0 - Math.min(1, p.cost * 4) * (H - 10)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Residual curve versus candidate origin position" style={{ maxWidth: '100%' }}>
      <polyline points={pts} fill="none" stroke="var(--c-group)" strokeWidth={2} />
      <line x1={(best / 200) * W} x2={(best / 200) * W} y1={0} y2={H} stroke="var(--text)" strokeDasharray="3 3" />
      <text x={2} y={H - 1} fontSize={9} fill="var(--chart-axis)">0 km</text>
      <text x={W - 2} y={H - 1} fontSize={9} fill="var(--chart-axis)" textAnchor="end">200 km</text>
    </svg>
  );
}
