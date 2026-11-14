import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NAV } from '../../routes';
import { runner } from '../../state/runner';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import { useEscape } from '../../utils/a11y';
import { QUICK_FAULTS, injectQuick } from '../domain/FaultInjector';

interface Cmd {
  id: string;
  label: string;
  group: string;
  run: () => void;
}
export function CommandPalette() {
  const open = useUiStore((s) => s.paletteOpen);
  const close = () => useUiStore.getState().set({ paletteOpen: false });
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const engineOn = useSimStore((s) => s.snap?.engineEnabled ?? true);
  useEscape(close, open);
  useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
      setTimeout(() => input.current?.focus(), 0);
    }
  }, [open]);
  const cmds = useMemo<Cmd[]>(
    () => [
      ...NAV.map((n) => ({ id: `go-${n.path}`, label: `Go to ${n.title}`, group: 'Navigate', run: () => nav(n.path) })),
      ...QUICK_FAULTS.map((f) => ({ id: `f-${f.key}`, label: `Inject: ${f.label}`, group: 'Fault', run: () => injectQuick(f) })),
      { id: 'engine', label: `Turn DeltaTrace engine ${engineOn ? 'OFF (fail-open)' : 'ON'}`, group: 'Engine', run: () => runner.setConfig({ engineEnabled: !engineOn }) },
      ...[1, 5, 10, 30].map((s) => ({ id: `sp-${s}`, label: `Speed ${s}×`, group: 'Simulation', run: () => runner.setSpeed(s) })),
      { id: 'play', label: 'Play / pause', group: 'Simulation', run: () => runner.toggle() },
      { id: 'clear', label: 'Clear all faults', group: 'Fault', run: () => runner.clearAll() },
      { id: 'theme', label: 'Toggle theme', group: 'View', run: () => useUiStore.getState().toggleTheme() },
      { id: 'present', label: 'Toggle presenter mode', group: 'View', run: () => useUiStore.getState().set({ presenter: !useUiStore.getState().presenter }) },
      { id: 'help', label: 'Show keyboard shortcuts', group: 'View', run: () => useUiStore.getState().set({ shortcutsOpen: true }) },
    ],
    [engineOn, nav],
  );
  const list = cmds.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));
  if (!open) return null;
  const go = (c?: Cmd) => {
    if (!c) return;
    close();
    c.run();
  };
  return (
    <>
      <div className="overlay" onClick={close} aria-hidden />
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <input
          ref={input}
          value={q}
          placeholder="Type a command: jump to a page, inject a fault, toggle the engine…"
          aria-label="Command"
          onChange={(e) => {
            setQ(e.target.value);
            setSel(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSel((s) => Math.min(list.length - 1, s + 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSel((s) => Math.max(0, s - 1));
            }
            if (e.key === 'Enter') go(list[sel]);
          }}
        />
        <ul role="listbox">
          {list.map((c, i) => (
            <li key={c.id}>
              <button role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onClick={() => go(c)}>
                {c.label}
                <span className="grp">{c.group}</span>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="muted" style={{ padding: 12 }}>No matching command</li>}
        </ul>
      </div>
    </>
  );
}
