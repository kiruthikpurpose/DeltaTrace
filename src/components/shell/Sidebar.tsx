import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { NavLink } from 'react-router-dom';
import { NAV } from '../../routes';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const mobileNav = useUiStore((s) => s.mobileNav);
  const engineOn = useSimStore((s) => s.snap?.engineEnabled ?? true);
  const groups = [...new Set(NAV.map((n) => n.group))];
  return (
    <aside className={`sidebar${mobileNav ? ' open' : ''}`} aria-label="Primary">
      <div className="brand">
        <Logo size={32} className="brand-logo" />
        <span>DeltaTrace</span>
      </div>
      <nav className="nav" aria-label="Main navigation">
        {groups.map((g) => (
          <div key={g}>
            <div className="nav-group">{g}</div>
            {NAV.filter((n) => n.group === g).map((n) => (
              <NavLink key={n.path} to={n.path} end={n.path === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} title={n.title} aria-label={n.title}>
                {n.icon}
                <span>{n.title}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="side-foot">
        <div className={`engine-pill ${engineOn ? 'on' : 'off'}`} role="status" aria-live="polite">
          <span className="dot" aria-hidden />
          <span className="label">{engineOn ? 'Engine ACTIVE' : 'Fail-open'}</span>
        </div>
        <span className="label">Simulated data</span>
        <button className="btn ghost sm" onClick={toggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} style={{ justifyContent: 'flex-start' }}>
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          <span className="label">Collapse</span>
        </button>
      </div>
    </aside>
  );
}
