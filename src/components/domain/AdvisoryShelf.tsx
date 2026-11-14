import { ChevronDown, ChevronRight, Undo2, Wrench } from 'lucide-react';
import { useState } from 'react';
import type { Advisory } from '../../engine';
import { runner } from '../../state/runner';
import { mmss } from '../../utils/format';

export function AdvisoryShelf({ advisories }: { advisories: Advisory[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [shelf, setShelf] = useState(true);
  return (
    <div className="shelf">
      <button type="button" className="shelf-head" onClick={() => setShelf((s) => !s)} aria-expanded={shelf}>
        <Wrench size={16} aria-hidden />
        <b>Instrument advisories</b>
        <span className="badge warn">{advisories.length}</span>
        <span className="grow" />
        {shelf ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
      </button>
      {shelf && (
        <ul className="shelf-body">
          {advisories.length === 0 && <li className="muted" style={{ padding: 8 }}>None. Alarms from low-trust sensors that nobody corroborates would appear here, never deleted.</li>}
          {advisories.map((a) => (
            <li key={a.id}>
              <button type="button" className="adv-row" onClick={() => setOpen(open === a.id ? null : a.id)} aria-expanded={open === a.id}>
                <b className="mono">{a.tag}</b>
                <span className="alarm-type">{a.type}</span>
                <span className="muted">trust {a.trust.toFixed(2)}</span>
                <span className="grow" />
                <span className="mono muted">{mmss(a.time)}</span>
              </button>
              {open === a.id && (
                <div className="adv-detail">
                  <p>{a.reason}</p>
                  <p className="muted">Restore to alarm list: if you disagree, the alarm returns to the operator list unchanged and the decision is audited.</p>
                  <button type="button" className="btn sm" onClick={() => runner.restoreAdvisory(a.id)}>
                    <Undo2 size={14} aria-hidden /> Restore to alarm list
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
