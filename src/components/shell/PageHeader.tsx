import type { ReactNode } from 'react';
import { InfoPopover } from '../ui/InfoPopover';

export function PageHeader({ title, purpose, info, actions }: { title: string; purpose: string; info?: string[]; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="grow">
        <h1>{title}</h1>
        <p>{purpose}</p>
      </div>
      <div className="row">
        {info && <InfoPopover bullets={info} />}
        {actions}
      </div>
    </header>
  );
}
