import { create } from 'zustand';
import { DEFAULT_CONFIG, cloneConfig, mergeConfig, type Config } from '../engine';
import { load, save } from './persist';

function initial(): Config {
  const saved = load<Partial<Config> | null>('config', null);
  let c: Config;
  try {
    c = saved && typeof saved === 'object' && !Array.isArray(saved) ? mergeConfig(DEFAULT_CONFIG, sanitize(saved)) : cloneConfig(DEFAULT_CONFIG);
  } catch {
    c = cloneConfig(DEFAULT_CONFIG);
  }
  c.engineEnabled = true; // always start with the engine on
  return c;
}
/** Keep only saved keys whose type matches the defaults (older or corrupted saves are ignored key by key). */
function sanitize(saved: Partial<Config>): Partial<Config> {
  const out: Record<string, unknown> = {};
  const def = DEFAULT_CONFIG as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(saved)) {
    if (!(k in def)) continue;
    if (k === 'alarms') {
      if (!v || typeof v !== 'object') continue;
      const alarms: Record<string, unknown> = {};
      for (const [ak, av] of Object.entries(v as unknown as Record<string, unknown>)) {
        const a = av as Record<string, unknown> | null;
        if (ak in DEFAULT_CONFIG.alarms && a && [a.limit, a.deadband, a.onDelay].every((n) => typeof n === 'number' && Number.isFinite(n))) alarms[ak] = a;
      }
      out.alarms = alarms;
    } else if (typeof v === typeof def[k] && (typeof v !== 'number' || Number.isFinite(v))) out[k] = v;
  }
  return out as Partial<Config>;
}
function initialSeed(): number {
  const s = load<number>('seed', 42);
  return typeof s === 'number' && Number.isFinite(s) ? s : 42;
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
  seed: initialSeed(),
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
