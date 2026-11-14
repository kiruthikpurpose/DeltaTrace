import { useMemo } from 'react';
import { runner } from '../../state/runner';
import { useSimStore } from '../../state/simStore';
import { mmss } from '../../utils/format';
import { Table } from '../ui/Table';
import type { AuditEntry } from '../../engine';

export function AuditLog({ height = 420 }: { height?: number }) {
  const snap = useSimStore((s) => s.snap)!;
  const book = runner.sim.book;
  const rows = useMemo<AuditEntry[]>(() => book.audit.slice(-400).reverse(), [book.totalAudit, snap.t >> 2]);
  return (
    <Table
      label="Audit log"
      maxHeight={height}
      rows={rows}
      rowKey={(r) => r.id}
      empty={<p className="muted" style={{ padding: 12 }}>No audit entries yet.</p>}
      columns={[
        { key: 't', header: 'Time', render: (r) => <span className="mono">{mmss(r.t)}</span>, sort: (a, b) => a.t - b.t },
        { key: 'actor', header: 'Actor', render: (r) => <span className={`badge ${r.actor === 'Operator' ? 'tune' : r.actor === 'DeltaTrace' ? 'group' : 'neutral'}`}>{r.actor}</span> },
        { key: 'action', header: 'Action', render: (r) => <b>{r.action}</b> },
        { key: 'reason', header: 'Reason', render: (r) => r.reason },
        { key: 'ref', header: 'Ref', render: (r) => <span className="mono muted" style={{ whiteSpace: 'nowrap' }}>{r.ref}</span> },
      ]}
    />
  );
}
