import { X } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { useEscape, useFocusTrap } from '../../utils/a11y';

export function Drawer({ open, onClose, title, children, wide, actions }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean; actions?: ReactNode }) {
  useEscape(onClose, open);
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open);
  if (!open) return null;
  return (
    <>
      <div className="overlay" onClick={onClose} aria-hidden />
      <aside className={`drawer${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Drawer'} ref={ref} tabIndex={-1}>
        <header className="drawer-head">
          <h3>{title}</h3>
          {actions}
          <button className="btn ghost icon" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="drawer-body">{children}</div>
      </aside>
    </>
  );
}
