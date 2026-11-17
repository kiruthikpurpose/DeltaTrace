import { Menu, Moon, Pause, Play, RotateCcw, Sun, Zap, Command, Dice5 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { NAV } from '../../routes';
import { runner } from '../../state/runner';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import { clock } from '../../utils/format';
import { Popover } from '../ui/Popover';
import { Segmented } from '../ui/Segmented';
import { Tooltip } from '../ui/Tooltip';
import { useConfigStore } from '../../state/configStore';
import { useState } from 'react';

export function TopBar() {
  const loc = useLocation();
  const item = NAV.find((n) => (n.path === '/' ? loc.pathname === '/' : loc.pathname.startsWith(n.path)));
  const snap = useSimStore((s) => s.snap)!;
  const running = useSimStore((s) => s.running);
  const speed = useSimStore((s) => s.speed);
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const seed = useConfigStore((s) => s.seed);
  const [seedDraft, setSeedDraft] = useState(String(seed));
  const flood = snap.raw10 >= 10;
  const active = snap.faults.filter((f) => f.started).length;
  return (
    <header className="topbar" role="banner">
      <button className="btn icon ghost menu-btn" aria-label="Open navigation" onClick={() => useUiStore.getState().set({ mobileNav: true })}>
        <Menu size={18} />
      </button>
      <svg id="brand-logo-m" className="brand-logo-m" viewBox="100 300 830 440" height={22} aria-hidden fill="none" strokeLinecap="round"><g stroke="var(--text)" strokeWidth={30}><path d="M126,332 C320,332 380,520 560,520 L690,520" /><path d="M126,520 H690" /><path d="M126,708 C320,708 380,520 560,520 L690,520" /><path d="M530,520 H884" /></g><circle cx={650} cy={520} r={168} stroke="var(--text-muted)" strokeWidth={14} /><path d="M498.3 392.7 A198 198 0 1 1 651.4 718.0" stroke="var(--brand)" strokeWidth={26} /><circle cx={884} cy={520} r={34} fill="var(--brand)" /></svg>
      <div className="crumb">
        <small>DeltaTrace Live › {item?.group ?? ''}</small>
        <b>{item?.title ?? 'Not found'}</b>
      </div>
      <div className="sim-controls" role="group" aria-label="Simulation controls">
        <Tooltip text={running ? 'Pause (Space)' : 'Play (Space)'}>
          <button className="btn icon ghost" onClick={() => runner.toggle()} aria-label={running ? 'Pause simulation' : 'Play simulation'}>
            {running ? <Pause size={16} /> : <Play size={16} />}
          </button>
        </Tooltip>
        <Segmented label="Speed" value={speed} onChange={(v) => runner.setSpeed(v)} options={[{ id: 1, label: '1×' }, { id: 5, label: '5×' }, { id: 10, label: '10×' }, { id: 30, label: '30×' }]} />
        <Tooltip text="Reset simulation with the current seed">
          <button className="btn icon ghost" onClick={() => runner.reset()} aria-label="Reset simulation">
            <RotateCcw size={16} />
          </button>
        </Tooltip>
        <span className="sim-clock" aria-label="Simulation clock">{clock(snap.t)}</span>
        <span className="seed-pop"><Popover label="Seed" trigger={<><Dice5 size={14} aria-hidden /> <span className="mono">{seed}</span></>}>
          <div className="stack">
            <b>Random seed</b>
            <p className="muted">The same seed, config and injection timeline reproduce the same run.</p>
            <div className="row">
              <input className="input" type="number" value={seedDraft} onChange={(e) => setSeedDraft(e.target.value)} aria-label="Seed value" />
              <button className="btn sm primary" onClick={() => runner.reset(Number(seedDraft) || 1)}>Apply &amp; reset</button>
            </div>
          </div>
        </Popover></span>
      </div>
      <div className="top-spacer" />
      <div className="live-chips" aria-label="Live indicators">
        <span className={`chip${flood ? ' flood' : ''}`} title="Raw alarms in the last 10 simulated minutes">Raw/10 min <b>{snap.raw10}</b></span>
        <span className="chip" title="Operator items (incidents + advisories) in the last 10 minutes">Items/10 min <b>{snap.op10}</b></span>
        <span className={`chip${active ? ' flood' : ''}`}>Faults <b>{active}</b></span>
      </div>
      <button className="btn" onClick={() => useUiStore.getState().set({ paletteOpen: true })} aria-label="Open command palette" title="Command palette (Ctrl/Cmd+K)">
        <Command size={15} /> <kbd>K</kbd>
      </button>
      <button className="btn primary" onClick={() => useUiStore.getState().set({ faultDrawer: true })} aria-label="Inject fault (F)">
        <Zap size={15} /> Inject fault
      </button>
      <button className="btn icon ghost" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title="Toggle theme">
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </header>
  );
}
