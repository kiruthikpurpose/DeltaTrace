import { create } from 'zustand';
import { load, save } from './persist';

export type Theme = 'light' | 'dark';
function initialTheme(): Theme {
  const saved = load<Theme | null>('theme', null);
  if (saved === 'light' || saved === 'dark') return saved;
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

interface UiState {
  theme: Theme;
  sidebarCollapsed: boolean;
  faultDrawer: boolean;
  paletteOpen: boolean;
  shortcutsOpen: boolean;
  selectedIncident: number | null;
  selectedChannel: number;
  presenter: boolean;
  mobileNav: boolean;
  explain: boolean;
  showTruth: boolean;
  chartWindow: 60 | 300 | 600;
  stripChannels: number[];
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  set: (p: Partial<UiState>) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  theme: initialTheme(),
  sidebarCollapsed: load('sidebarCollapsed', false),
  faultDrawer: false,
  paletteOpen: false,
  shortcutsOpen: false,
  selectedIncident: null,
  selectedChannel: 5,
  presenter: false,
  mobileNav: false,
  explain: false,
  showTruth: false,
  chartWindow: 300,
  stripChannels: [4, 5, 7],
  setTheme: (t) => {
    save('theme', t);
    set({ theme: t });
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
  toggleSidebar: () => {
    const v = !get().sidebarCollapsed;
    save('sidebarCollapsed', v);
    set({ sidebarCollapsed: v });
  },
  set: (p) => set(p),
}));
