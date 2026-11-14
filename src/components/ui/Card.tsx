import clsx from 'clsx';
import type { ReactNode } from 'react';

interface Props {
  title?: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  accent?: 'trust' | 'group' | 'tune' | 'bad' | 'brand';
  flush?: boolean;
  className?: string;
  bodyClass?: string;
  children?: ReactNode;
  label?: string;
}
export function Card({ title, sub, actions, accent, flush, className, bodyClass, children, label }: Props) {
  return (
    <section className={clsx('card', accent && `accent-${accent}`, className)} aria-label={label ?? (typeof title === 'string' ? title : undefined)}>
      {(title || actions) && (
        <header className="card-head">
          <div className="grow">
            <h3>{title}</h3>
            {sub && <div className="sub">{sub}</div>}
          </div>
          {actions}
        </header>
      )}
      <div className={clsx('card-body', flush && 'flush', bodyClass)}>{children}</div>
    </section>
  );
}
