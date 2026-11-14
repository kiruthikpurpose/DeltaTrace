import type { ReactNode } from 'react';

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <b style={{ color: 'var(--text)' }}>{title}</b>
      {children && <span>{children}</span>}
    </div>
  );
}
