import clsx from 'clsx';
import { AlertTriangle, CircleCheck, CircleHelp, Cpu, Waves, Wrench, ShieldAlert, ScanSearch } from 'lucide-react';
import type { ReactNode } from 'react';
import type { IncidentClass, TrustClass } from '../../engine';

export function Badge({ tone = 'neutral', children, icon, title }: { tone?: string; children: ReactNode; icon?: ReactNode; title?: string }) {
  return (
    <span className={clsx('badge', tone)} title={title}>
      {icon}
      {children}
    </span>
  );
}

export const CLASS_NAME: Record<IncidentClass, string> = {
  'process-event': 'Process event',
  'instrument-fault': 'Instrument fault',
  'data-integrity': 'Data-integrity',
  'needs-review': 'Needs review',
};
export function ClassIcon({ cls, size = 14 }: { cls: IncidentClass; size?: number }) {
  // distinct icon + shape per class (colour is never the only signal)
  if (cls === 'process-event') return <Waves size={size} aria-hidden />;
  if (cls === 'instrument-fault') return <Wrench size={size} aria-hidden />;
  if (cls === 'data-integrity') return <ShieldAlert size={size} aria-hidden />;
  return <CircleHelp size={size} aria-hidden />;
}
export function ClassBadge({ cls, provisional }: { cls: IncidentClass; provisional?: boolean }) {
  return (
    <Badge tone={cls} icon={<ClassIcon cls={cls} />}>
      {provisional ? 'Assessing…' : CLASS_NAME[cls]}
    </Badge>
  );
}
export function TrustBadge({ cls }: { cls: TrustClass }) {
  const tone = cls === 'GOOD' ? 'good' : cls === 'UNCERTAIN' ? 'uncertain' : 'bad';
  const icon = cls === 'GOOD' ? <CircleCheck size={12} aria-hidden /> : cls === 'UNCERTAIN' ? <AlertTriangle size={12} aria-hidden /> : <ScanSearch size={12} aria-hidden />;
  return (
    <Badge tone={tone} icon={icon}>
      {cls}
    </Badge>
  );
}
export { Cpu };
