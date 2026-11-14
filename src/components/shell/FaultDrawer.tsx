import { useUiStore } from '../../state/uiStore';
import { Drawer } from '../ui/Drawer';
import { FaultInjector } from '../domain/FaultInjector';

export function FaultDrawer() {
  const open = useUiStore((s) => s.faultDrawer);
  return (
    <Drawer open={open} onClose={() => useUiStore.getState().set({ faultDrawer: false })} title="Fault injector">
      <p className="muted">Inject faults into the running simulation. Keys <kbd>1</kbd>–<kbd>9</kbd> trigger the quick faults from anywhere.</p>
      <FaultInjector />
    </Drawer>
  );
}
