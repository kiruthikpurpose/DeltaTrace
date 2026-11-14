import { create } from 'zustand';
import type { Snapshot } from '../engine';

interface SimState {
  snap: Snapshot | null;
  running: boolean;
  speed: number;
  replaying: boolean;
  caption: string;
  tick: number;
  set: (p: Partial<SimState>) => void;
}
export const useSimStore = create<SimState>((set) => ({
  snap: null,
  running: true,
  speed: 1,
  replaying: false,
  caption: '',
  tick: 0,
  set: (p) => set(p),
}));
