import clsx from 'clsx';
import { Suspense, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { runner } from '../../state/runner';
import { useUiStore } from '../../state/uiStore';
import { useSimStore } from '../../state/simStore';
import { isTyping } from '../../utils/keyboard';
import { Modal } from '../ui/Modal';
import { PageSkeleton } from '../ui/Skeleton';
import { QUICK_FAULTS, injectQuick } from '../domain/FaultInjector';
import { CommandPalette } from './CommandPalette';
import { ErrorBoundary } from './ErrorBoundary';
import { FaultDrawer } from './FaultDrawer';
import { Sidebar } from './Sidebar';
import { ToastHost } from './ToastHost';
import { TopBar } from './TopBar';

const SHORTCUTS: [string, string][] = [
  ['Space', 'Play / pause the simulation'],
  ['F', 'Open the fault injector'],
  ['1 – 9', 'Quick faults (listed in the injector)'],
  ['Ctrl/Cmd + K', 'Command palette'],
  ['P', 'Presenter mode'],
  ['R', 'Emergency reset (presenter mode or Guided Demo)'],
  ['?', 'This help'],
  ['Esc', 'Close drawers and dialogs'],
];

export function AppShell() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const presenter = useUiStore((s) => s.presenter);
  const theme = useUiStore((s) => s.theme);
  const shortcuts = useUiStore((s) => s.shortcutsOpen);
  const mobileNav = useUiStore((s) => s.mobileNav);
  const loc = useLocation();
  const nav = useNavigate();
  const replaying = useSimStore((s) => s.replaying);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    runner.start();
  }, []);
  useEffect(() => {
    useUiStore.getState().set({ mobileNav: false });
  }, [loc.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        useUiStore.getState().set({ paletteOpen: !useUiStore.getState().paletteOpen });
        return;
      }
      if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      if (k === ' ') {
        if ((e.target as HTMLElement).tagName === 'BUTTON') return;
        e.preventDefault();
        runner.toggle();
      } else if (k === 'f' || k === 'F') useUiStore.getState().set({ faultDrawer: !useUiStore.getState().faultDrawer });
      else if (k === '?') useUiStore.getState().set({ shortcutsOpen: true });
      else if (k === 'p' || k === 'P') useUiStore.getState().set({ presenter: !useUiStore.getState().presenter });
      else if ((k === 'r' || k === 'R') && (useUiStore.getState().presenter || loc.pathname === '/demo')) runner.emergencyReset();
      else if (/^[1-9]$/.test(k)) {
        const q = QUICK_FAULTS.find((f) => f.key === k);
        if (q) injectQuick(q);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loc.pathname]);

  return (
    <div className={clsx('app', collapsed && 'collapsed', presenter && 'presenter')}>
      {mobileNav && <div className="overlay nav-overlay" onClick={() => useUiStore.getState().set({ mobileNav: false })} aria-hidden />}
      <a href="#main" className="skip-link">Skip to content</a>
      <Sidebar />
      <div className="main">
        <TopBar />
        {replaying && <ReplayBanner />}
        <main id="main" tabIndex={-1}>
          <ErrorBoundary resetKey={loc.pathname}>
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
        <footer className="sim-label" role="note">
          <span>Simulated data — demonstration only</span>
          <span>DeltaTrace Live</span>
        </footer>
      </div>
            <FaultDrawer />
      <CommandPalette />
      <ToastHost />
      <Modal open={shortcuts} onClose={() => useUiStore.getState().set({ shortcutsOpen: false })} title="Keyboard shortcuts" footer={<button className="btn primary" onClick={() => useUiStore.getState().set({ shortcutsOpen: false })}>Close</button>}>
        <table className="tbl" aria-label="Keyboard shortcuts">
          <tbody>
            {SHORTCUTS.map(([k, d]) => (
              <tr key={k}>
                <td><kbd>{k}</kbd></td>
                <td>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn sm" onClick={() => { useUiStore.getState().set({ shortcutsOpen: false }); nav('/how-it-works'); }}>Open How It Works</button>
      </Modal>
    </div>
  );
}

function ReplayBanner() {
  const caption = useSimStore((s) => s.caption);
  useSimStore((s) => s.tick);
  runner.replayCaption();
  return (
    <div className="replay-banner" role="status">
      <b>REPLAY 0.25×</b>
      <span className="grow">{useSimStore.getState().caption || caption}</span>
      <button className="btn sm" onClick={() => runner.stopReplay()}>Stop replay</button>
    </div>
  );
}
