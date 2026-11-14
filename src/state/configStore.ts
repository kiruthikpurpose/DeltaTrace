import { create } from 'zustand';
import { DEFAULT_CONFIG, cloneConfig, mergeConfig, type Config } from '../engine';
import { load, save } from './persist';

function initial(): Config {
  const saved = load<Partial<Config> | null>('config', null);
  const c = saved ? mergeConfig(DEFAULT_CONFIG, saved) : cloneConfig(DEFAULT_CONFIG);
  c.engineEnabled = true; // always start with the engine on
  return c;
}
interface ConfigState {
  cfg: Config;
  seed: number;
  patch: (p: Partial<Config>, persist?: boolean) => void;
  setSeed: (s: number) => void;
  reset: () => void;
}
export const useConfigStore = create<ConfigState>((set, get) => ({
  cfg: initial(),
  seed: load('seed', 42),
  patch: (p, persist = true) => {
    const cfg = mergeConfig(get().cfg, p);
    if (persist) save('config', cfg);
    set({ cfg });
  },
  setSeed: (s) => {
    save('seed', s);
    set({ seed: s });
  },
  reset: () => {
    const cfg = cloneConfig(DEFAULT_CONFIG);
    save('config', cfg);
    set({ cfg });
  },
}));
