import { useMemo } from 'react';
import { runner } from '../../state/runner';
import { useSimStore } from '../../state/simStore';
import { mmss } from '../../utils/format';

export function WriteBackFeed({ height = 420 }: { height?: number }) {
  const snap = useSimStore((s) => s.snap)!;
  void snap.version;
  const book = runner.sim.book;
  const rows = useMemo(() => book.writes.slice(-150).reverse(), [book.totalWrites, snap.t >> 2]);
  return (
    <ul className="feed" style={{ maxHeight: height }} aria-label="Simulated write-back tag feed (dry run)">
      {rows.length === 0 && <li className="muted" style={{ padding: 12 }}>No writes yet. Inject a fault to see incident records written back.</li>}
      {rows.map((w) => (
        <li key={w.id}>
          <span className="mono muted">{mmss(w.t)}</span>
          <code title={`${w.tag} = ${w.value}`}>
            <span className="tag">{w.tag.replace('ns=2;s=', '')}</span> = {typeof w.value === 'string' ? `"${w.value}"` : w.value}
          </code>
          <span className={`badge ${w.kind === 'setting' ? 'tune' : w.kind === 'quality' ? 'trust' : 'group'}`}>{w.kind}</span>
        </li>
      ))}
    </ul>
  );
}
