import type { ReactNode } from 'react';

export function Legend({ items }: { items: { color: string; label: ReactNode }[] }) {
  return (
    <div className="legend">
      {items.map((i, k) => (
        <span className="item" key={k}>
          <span className="sw" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
