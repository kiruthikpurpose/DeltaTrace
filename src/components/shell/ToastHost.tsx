import { Bell, CheckCircle2, AlertTriangle, ShieldAlert, Layers } from 'lucide-react';
import { useToastStore } from '../../state/toastStore';

const ICON = { info: Bell, ok: CheckCircle2, warn: AlertTriangle, bad: ShieldAlert, group: Layers, trust: ShieldAlert };
export function ToastHost() {
  const items = useToastStore((s) => s.items);
  return (
    <div className="toast-host" role="status" aria-live="polite" aria-label="Notifications">
      {items.map((t) => {
        const I = ICON[t.kind];
        return (
          <div key={t.id} className={`toast ${t.kind}`}>
            <I size={16} aria-hidden style={{ marginTop: 2, flex: 'none' }} />
            <span>{t.text}</span>
          </div>
        );
      })}
    </div>
  );
}
