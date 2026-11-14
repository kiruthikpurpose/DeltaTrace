import { create } from 'zustand';
import type { ChangeRecord, Disposition } from '../engine';
import { load, save } from './persist';

export interface SavedRun {
  id: number;
  name: string;
  seed: number;
  at: number;
  timeline: unknown[];
}
interface LogState {
  changeLog: ChangeRecord[];
  dispositions: Record<number, Disposition>;
  savedRuns: SavedRun[];
  addChange: (c: ChangeRecord) => void;
  markReverted: (id: number) => void;
  setDisposition: (inc: number, d: Disposition) => void;
  saveRun: (r: SavedRun) => void;
  clear: () => void;
}
export const useLogStore = create<LogState>((set, get) => ({
  changeLog: load<ChangeRecord[]>('changeLog', []),
  dispositions: load<Record<number, Disposition>>('dispositions', {}),
  savedRuns: load<SavedRun[]>('savedRuns', []),
  addChange: (c) => {
    const changeLog = [c, ...get().changeLog].slice(0, 200);
    save('changeLog', changeLog);
    set({ changeLog });
  },
  markReverted: (id) => {
    const changeLog = get().changeLog.map((c) => (c.id === id ? { ...c, status: 'Reverted' as const } : c));
    save('changeLog', changeLog);
    set({ changeLog });
  },
  setDisposition: (inc, d) => {
    const dispositions = { ...get().dispositions, [inc]: d };
    save('dispositions', dispositions);
    set({ dispositions });
  },
  saveRun: (r) => {
    const savedRuns = [r, ...get().savedRuns].slice(0, 10);
    save('savedRuns', savedRuns);
    set({ savedRuns });
  },
  clear: () => {
    save('changeLog', []);
    save('dispositions', {});
    save('savedRuns', []);
    set({ changeLog: [], dispositions: {}, savedRuns: [] });
  },
}));
