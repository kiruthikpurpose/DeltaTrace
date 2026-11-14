import clsx from 'clsx';
import type { ReactNode } from 'react';

export function Chip({ children, className, onClick, pressed, title }: { children: ReactNode; className?: string; onClick?: () => void; pressed?: boolean; title?: string }) {
  if (onClick) {
    return (
      <button type="button" className={clsx('chip', className)} onClick={onClick} aria-pressed={pressed} title={title}>
        {children}
      </button>
    );
  }
  return (
    <span className={clsx('chip', className)} title={title}>
      {children}
    </span>
  );
}
