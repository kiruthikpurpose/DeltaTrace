import clsx from 'clsx';
import { useMemo, useState, type ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  sort?: (a: T, b: T) => number;
  className?: string;
}
interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (r: T) => string | number;
  onRowClick?: (r: T) => void;
  selected?: string | number | null;
  maxHeight?: number;
  label: string;
  empty?: ReactNode;
  /** virtualise when more rows than this (fixed-height windowing) */
  virtualAbove?: number;
}
const ROW_H = 38;
export function Table<T>({ columns, rows, rowKey, onRowClick, selected, maxHeight = 420, label, empty, virtualAbove = 200 }: Props<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [scroll, setScroll] = useState(0);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    return [...rows].sort((a, b) => col.sort!(a, b) * sort.dir);
  }, [rows, sort, columns]);
  const virtual = sorted.length > virtualAbove;
  const start = virtual ? Math.max(0, Math.floor(scroll / ROW_H) - 10) : 0;
  const end = virtual ? Math.min(sorted.length, start + Math.ceil(maxHeight / ROW_H) + 20) : sorted.length;
  const slice = sorted.slice(start, end);
  return (
    <div className="table-wrap" style={{ ['--max-h' as string]: `${maxHeight}px` }} onScroll={virtual ? (e) => setScroll((e.target as HTMLElement).scrollTop) : undefined}>
      <table className="tbl" aria-label={label}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.className} aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                {c.sort ? (
                  <button onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: (s.dir * -1) as 1 | -1 } : { key: c.key, dir: 1 }))}>
                    {c.header}
                    {sort?.key === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
                  </button>
                ) : (
                  c.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {virtual && start > 0 && (
            <tr aria-hidden style={{ height: start * ROW_H }}>
              <td colSpan={columns.length} />
            </tr>
          )}
          {slice.map((r) => {
            const k = rowKey(r);
            return (
              <tr key={k} className={clsx(onRowClick && 'clickable', selected === k && 'sel')} style={virtual ? { height: ROW_H } : undefined} onClick={onRowClick ? () => onRowClick(r) : undefined} tabIndex={onRowClick ? 0 : undefined} onKeyDown={onRowClick ? (e) => (e.key === 'Enter' ? onRowClick(r) : undefined) : undefined}>
                {columns.map((c) => (
                  <td key={c.key} className={c.className}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            );
          })}
          {virtual && end < sorted.length && (
            <tr aria-hidden style={{ height: (sorted.length - end) * ROW_H }}>
              <td colSpan={columns.length} />
            </tr>
          )}
        </tbody>
      </table>
      {sorted.length === 0 && empty}
    </div>
  );
}
