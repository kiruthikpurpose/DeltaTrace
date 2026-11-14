import { Undo2 } from 'lucide-react';
import { runner } from '../../state/runner';
import { useLogStore } from '../../state/logStore';
import { mmss } from '../../utils/format';
import { Table } from '../ui/Table';

export function ChangeLog() {
  const log = useLogStore((s) => s.changeLog);
  return (
    <Table
      label="Management-of-change log"
      maxHeight={300}
      rows={log}
      rowKey={(r) => r.id}
      empty={<p className="muted" style={{ padding: 12 }}>No approved changes yet. Run a replay and approve a recommendation to create a Management-of-Change record.</p>}
      columns={[
        { key: 'id', header: 'MOC', render: (r) => <b className="mono">MOC-{r.id}</b> },
        { key: 't', header: 'Timestamp', render: (r) => <span className="mono">{mmss(r.t)} · {new Date(r.wall).toLocaleTimeString()}</span> },
        { key: 'who', header: 'Who', render: (r) => r.who },
        { key: 'pt', header: 'Point', render: (r) => r.point },
        { key: 'chg', header: 'Old → new', render: (r) => <span className="mono">{r.old} → {r.new}</span> },
        { key: 'ev', header: 'Evidence', render: (r) => <span className="muted">{r.evidence}</span> },
        { key: 'st', header: 'Status', render: (r) => <span className={`badge ${r.status === 'Approved' ? 'ok' : 'warn'}`}>{r.status}</span> },
        { key: 'a', header: '', render: (r) => (r.status === 'Approved' ? <button className="btn sm" onClick={() => runner.revert(r)}><Undo2 size={13} /> Revert</button> : null) },
      ]}
    />
  );
}
