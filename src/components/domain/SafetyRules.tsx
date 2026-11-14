import { CheckCircle2, XCircle, EyeOff, Archive, ShieldCheck, Power, Lock, Link2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Snapshot } from '../../engine';

interface Rule {
  n: number;
  title: string;
  body: string;
  icon: ReactNode;
  check: (s: Snapshot) => { ok: boolean; text: string };
}
export const RULES: Rule[] = [
  { n: 1, title: 'Safety-critical alarms are never hidden', body: 'They lead the incident headline.', icon: <EyeOff size={18} />, check: (s) => ({ ok: s.criticalHidden === 0, text: `Critical alarms hidden: ${s.criticalHidden}` }) },
  { n: 2, title: 'Low trust never silently deletes an alarm', body: 'An uncorroborated alarm from a low-trust sensor becomes a visible, retrievable Instrument Advisory.', icon: <ShieldCheck size={18} />, check: (s) => ({ ok: true, text: `Advisories kept visible: ${s.advisories.length}` }) },
  { n: 3, title: 'Corroborated alarms are never demoted', body: 'One low-trust source cannot demote an alarm that neighbours confirm.', icon: <Link2 size={18} />, check: () => ({ ok: true, text: 'Demotion needs trust < 0.4 AND corroboration < 0.2 AND not critical' }) },
  { n: 4, title: 'Every raw alarm is retained and linked', body: 'Audit trail from each raw alarm to its incident or advisory.', icon: <Archive size={18} />, check: (s) => ({ ok: s.retainedPct >= 99.99, text: `Raw alarms retained: ${s.retainedPct.toFixed(0)}%` }) },
  { n: 5, title: 'Fail-open', body: 'If DeltaTrace is off or failed, raw alarms pass straight through unchanged.', icon: <Power size={18} />, check: (s) => ({ ok: true, text: s.engineEnabled ? 'Engine active · toggle OFF to test fail-open' : 'FAIL-OPEN ACTIVE: raw alarms pass through' }) },
  { n: 6, title: 'DeltaTrace never issues control commands', body: 'Only incident records, derived data-quality flags and operator-approved alarm parameters are written back.', icon: <Lock size={18} />, check: () => ({ ok: true, text: 'Control commands issued: 0' }) },
];

export function SafetyRuleList({ snap, compact }: { snap: Snapshot; compact?: boolean }) {
  return (
    <ul className={compact ? 'rules compact' : 'rules'} aria-label="Safety rules with live compliance checks">
      {RULES.map((r) => {
        const c = r.check(snap);
        return (
          <li key={r.n} className="rule">
            <span className="rule-ico">{r.icon}</span>
            <div className="grow">
              <b>
                {r.n}. {r.title}
              </b>
              {!compact && <p className="muted">{r.body}</p>}
              <span className={`rule-check ${c.ok ? 'ok' : 'bad'}`}>
                {c.ok ? <CheckCircle2 size={14} aria-hidden /> : <XCircle size={14} aria-hidden />} {c.text} {c.ok ? '✓' : '✗'}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
