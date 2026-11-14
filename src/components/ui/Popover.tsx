import { useEffect, useRef, useState, type ReactNode } from 'react';

export function Popover({ trigger, children, right, label }: { trigger: ReactNode; children: ReactNode; right?: boolean; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const f = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', f);
    document.addEventListener('keydown', k);
    return () => {
      document.removeEventListener('mousedown', f);
      document.removeEventListener('keydown', k);
    };
  }, [open]);
  return (
    <span className="popover-wrap" ref={ref}>
      <button type="button" className="btn ghost sm" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)}>
        {trigger}
      </button>
      {open && (
        <div className={`popover${right ? ' right' : ''}`} role="dialog" aria-label={label}>
          {children}
        </div>
      )}
    </span>
  );
}
