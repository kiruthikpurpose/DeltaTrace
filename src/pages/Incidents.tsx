import { Search, GitMerge } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Incident, IncidentClass } from '../engine';
import { IncidentDetail } from '../components/domain/IncidentDetail';
import { PageHeader } from '../components/shell/PageHeader';
import { ClassBadge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Segmented } from '../components/ui/Segmented';
import { Table } from '../components/ui/Table';
import { runner } from '../state/runner';
import { useSimStore } from '../state/simStore';
import { useUiStore } from '../state/uiStore';
import { CHANNELS } from '../engine';
import { incId, mmss } from '../utils/format';

const CLASSES: { id: IncidentClass | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'process-event', label: 'Process' },
  { id: 'instrument-fault', label: 'Instrument' },
  { id: 'data-integrity', label: 'Data integrity' },
  { id: 'needs-review', label: 'Review' },
];

export default function Incidents() {
  const snap = useSimStore((s) => s.snap)!;
  const sel = useUiStore((s) => s.selectedIncident);
  const [cls, setCls] = useState<IncidentClass | 'all'>('all');
  const [sort, setSort] = useState<'rank' | 'time'>('rank');
  const [q, setQ] = useState('');
  const [showArchive, setShowArchive] = useState(true);
  const archive = runner.sim.agg.archive;
  const all = useMemo<Incident[]>(() => {
    const list = [...snap.openIncidents.map((i) => ({ ...i })), ...(showArchive ? archive.map((i) => ({ ...i })) : [])];
    return list
      .filter((i) => cls === 'all' || i.cls === cls)
      .filter((i) => !q || i.channels.some((c) => CHANNELS[c].tag.toLowerCase().includes(q.toLowerCase())) || incId(i.id).toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => (sort === 'rank' ? Number(b.status === 'open') - Number(a.status === 'open') || (a.rank || 99) - (b.rank || 99) || b.score - a.score : b.openedAt - a.openedAt));
  }, [snap.version, cls, sort, q, showArchive]);
  const current = all.find((i) => i.id === sel) ?? all[0] ?? null;
  return (
    <div className="page">
      <PageHeader
        title="Incidents"
        purpose="Alarms grouped by pressure-wave delay, classified and ranked. Every raw alarm stays linked."
        info={['Pick an incident to see why it was classified that way.', 'The timeline shows alarms by position and time; alarms on the dashed wavefront corroborate each other.', 'Operator dispositions become labels that feed the tuner.']}
      />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          {CLASSES.map((c) => (
            <button key={c.id} className="chip" aria-pressed={cls === c.id} onClick={() => setCls(c.id)}>{c.label}</button>
          ))}
        </div>
        <div className="row">
          <label className="row" style={{ gap: 6 }}>
            <Search size={14} aria-hidden />
            <input className="input" placeholder="Search tag (PT-5) or INC-…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search incidents" />
          </label>
          <Segmented label="Sort" value={sort} onChange={setSort} options={[{ id: 'rank', label: 'By rank' }, { id: 'time', label: 'By time' }]} />
          <button className="chip" aria-pressed={showArchive} onClick={() => setShowArchive((s) => !s)}>Closed archive (last 200)</button>
        </div>
      </div>
      <div className="split-view">
        <Card title={`Incidents (${all.length})`} flush>
          <Table
            label="Incidents"
            rows={all}
            rowKey={(i) => i.id}
            selected={current?.id ?? null}
            onRowClick={(i) => useUiStore.getState().set({ selectedIncident: i.id })}
            maxHeight={640}
            empty={<EmptyState icon={<GitMerge />} title="No incidents yet">Inject a fault from the Live Console (key F) to create some.</EmptyState>}
            columns={[
              { key: 'id', header: 'ID', render: (i) => <b className="mono">{incId(i.id)}</b>, sort: (a, b) => a.id - b.id },
              { key: 'rank', header: 'Rank', render: (i) => (i.status === 'open' ? `#${i.rank}` : '–'), sort: (a, b) => a.rank - b.rank },
              { key: 'cls', header: 'Class', render: (i) => <ClassBadge cls={i.cls} provisional={i.provisional} /> },
              { key: 'n', header: 'Alarms', render: (i) => <span className="num">{i.alarmIds.length}</span>, sort: (a, b) => a.alarmIds.length - b.alarmIds.length, className: 'r' },
              { key: 'ch', header: 'Sources', render: (i) => <span className="muted">{i.channels.slice(0, 4).map((c) => CHANNELS[c].tag).join(', ')}{i.channels.length > 4 ? '…' : ''}</span> },
              { key: 't', header: 'Opened', render: (i) => <span className="mono">{mmss(i.openedAt)}</span>, sort: (a, b) => a.openedAt - b.openedAt },
              { key: 'st', header: 'Status', render: (i) => <span className={`badge ${i.status === 'open' ? 'ok' : 'neutral'}`}>{i.status}</span> },
            ]}
          />
        </Card>
        <Card title={current ? `Detail · ${incId(current.id)}` : 'Detail'}>
          {current ? <IncidentDetail inc={current} /> : <EmptyState title="Select an incident">The detail view explains its class, origin and member alarms.</EmptyState>}
        </Card>
      </div>
    </div>
  );
}
