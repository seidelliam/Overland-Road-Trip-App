'use client';

import { create } from 'zustand';

export type Theme = 'dark' | 'light';

// Apply the theme to <html> and persist it. Kept outside React so the basemap,
// the toggle, and the no-flash inline script in layout.tsx all agree.
function apply(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem('theme', theme);
  } catch {
    // Private mode / storage disabled — theme just won't persist.
  }
}

type ThemeState = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
  /** Read the saved preference from localStorage (call once on mount). */
  init: () => void;
};

export const useTheme = create<ThemeState>((set, get) => ({
  // Default matches the server-rendered markup (dark); init() reconciles with
  // the saved preference on mount.
  theme: 'dark',
  setTheme: (theme) => {
    apply(theme);
    set({ theme });
  },
  toggle: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
  init: () => {
    let saved: Theme = 'dark';
    try {
      const v = localStorage.getItem('theme');
      if (v === 'light' || v === 'dark') saved = v;
    } catch {
      // ignore
    }
    get().setTheme(saved);
  },
}));
