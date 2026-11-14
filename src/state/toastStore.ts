import { create } from 'zustand';

export type ToastKind = 'info' | 'ok' | 'warn' | 'bad' | 'group' | 'trust';
export interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
}
let nid = 1;
interface ToastState {
  items: Toast[];
  push: (text: string, kind?: ToastKind) => void;
  dismiss: (id: number) => void;
}
export const useToastStore = create<ToastState>((set, get) => ({
  items: [],
  push: (text, kind = 'info') => {
    const id = nid++;
    set({ items: [...get().items.slice(-3), { id, text, kind }] });
    setTimeout(() => get().dismiss(id), 4500);
  },
  dismiss: (id) => set({ items: get().items.filter((t) => t.id !== id) }),
}));
export const toast = (text: string, kind: ToastKind = 'info') => useToastStore.getState().push(text, kind);
