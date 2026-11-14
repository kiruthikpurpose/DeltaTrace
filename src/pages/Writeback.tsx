import { Download, Lock } from 'lucide-react';
import { AuditLog } from '../components/domain/AuditLog';
import { SafetyRuleList } from '../components/domain/SafetyRules';
import { WriteBackFeed } from '../components/domain/WriteBackFeed';
import { PageHeader } from '../components/shell/PageHeader';
import { Card } from '../components/ui/Card';
import { runner } from '../state/runner';
import { useSimStore } from '../state/simStore';
import { download } from '../utils/download';
import { toCsv } from '../utils/format';

export default function Writeback() {
  const snap = useSimStore((s) => s.snap)!;
  const book = runner.sim.book;
  const exportCsv = () => download('deltatrace-audit.csv', toCsv(book.audit.map((a) => ({ id: a.id, sim_time_s: a.t, actor: a.actor, action: a.action, reason: a.reason, ref: a.ref ?? '' }))), 'text/csv');
  const exportJson = () => download('deltatrace-audit.json', JSON.stringify({ simulated: true, seed: snap.seed, audit: book.audit, writes: book.writes }, null, 2));
  return (
    <div className="page">
      <PageHeader
        title="Write-back & Audit"
        purpose="Everything DeltaTrace writes back to the control system (dry run) and every decision it makes, with who and why."
        info={['Only three kinds of writes exist: incident records, derived data-quality flags and operator-approved alarm parameters.', 'The audit log records every grouping decision, demotion, class change, approval, revert and fail-open event.']}
        actions={
          <>
            <button className="btn" onClick={exportCsv}><Download size={14} /> Export CSV</button>
            <button className="btn" onClick={exportJson}><Download size={14} /> Export JSON</button>
          </>
        }
      />
      <Card accent="bad" className="lock-panel">
        <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
          <div className="lock-ico"><Lock size={28} aria-hidden /></div>
          <div className="grow">
            <h2 style={{ fontSize: 20 }}>DeltaTrace never issues control commands</h2>
            <p className="muted" style={{ marginBottom: 10 }}>Read-only in, controlled write-back out. Six safety rules are enforced in code and verified live below.</p>
            <SafetyRuleList snap={snap} />
          </div>
        </div>
      </Card>
      <div className="two-col">
        <Card title="Written to control system (simulated)" sub={`${book.totalWrites} writes this run · OPC-UA style tags`} accent="group">
          <WriteBackFeed />
        </Card>
        <Card title="Audit log" sub={`${book.totalAudit} entries this run`} accent="trust" flush>
          <AuditLog />
        </Card>
      </div>
    </div>
  );
}
