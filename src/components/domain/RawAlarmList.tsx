import { AlertOctagon, AlertTriangle, Info } from 'lucide-react';
import { memo } from 'react';
import type { RawAlarm } from '../../engine';
import { alarmId, mmss } from '../../utils/format';
import { EmptyState } from '../ui/EmptyState';

const ICON = [null, <Info key="i" size={14} aria-label="low" />, <AlertTriangle key="w" size={14} aria-label="medium" />, <AlertTriangle key="h" size={14} aria-label="high" />, <AlertOctagon key="c" size={14} aria-label="critical" />];
const COLOR = ['', 'var(--info)', 'var(--warn)', 'var(--bad)', 'var(--bad)'];

export const RawAlarmRow = memo(function RawAlarmRow({ a }: { a: RawAlarm }) {
  return (
    <li className="alarm-row" style={{ borderLeftColor: COLOR[a.severity] }}>
      <span style={{ color: COLOR[a.severity], display: 'inline-flex' }}>{ICON[a.severity]}</span>
      <b className="mono">{a.tag}</b>
      <span className="alarm-type">{a.type}</span>
      <span className="muted">{a.priority}</span>
      {a.safetyCritical && <span className="badge bad">CRIT</span>}
      {a.state === 'active' && <span className="pulse-dot" aria-label="active" />}
      <span className="grow" />
      <span className="mono muted">{mmss(a.trueTime)}</span>
    </li>
  );
});

export function RawAlarmList({ alarms, max = 60, height = 330 }: { alarms: RawAlarm[]; max?: number; height?: number }) {
  const list = alarms.filter((a) => a.source === 'scada').slice(0, max);
  if (!list.length) return <EmptyState icon={<Info />} title="No alarms">The existing system is quiet. Inject a fault to see what happens.</EmptyState>;
  return (
    <ul className="alarm-list" style={{ maxHeight: height }} aria-label="Raw alarm list, newest first" aria-live="off">
      {list.map((a) => (
        <RawAlarmRow key={a.id} a={a} />
      ))}
    </ul>
  );
}

export { alarmId };
