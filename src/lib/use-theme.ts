'use client';

import { create } from 'zustand';

// The user-facing theme choice. 'outdoors' is a map style (Mapbox outdoors-v12)
// that pairs with the light UI — see uiThemeFor.
export type Theme = 'dark' | 'light' | 'outdoors';

// Which set of UI color tokens a theme uses. Outdoors is a bright topographic
// basemap, so it rides the light palette.
export function uiThemeFor(theme: Theme): 'dark' | 'light' {
  return theme === 'dark' ? 'dark' : 'light';
}

// Apply the theme to <html> and persist it. Kept outside React so the basemap,
// the picker, and the no-flash inline script in layout.tsx all agree. The
// data-theme attribute only ever carries the UI palette ('dark' | 'light');
// the full choice (incl. 'outdoors') lives in localStorage.
function apply(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = uiThemeFor(theme);
  try {
    localStorage.setItem('theme', theme);
  } catch {
    // Private mode / storage disabled — theme just won't persist.
  }
}

type ThemeState = {
  theme: Theme;
  setTheme: (t: Theme) => void;
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
  init: () => {
    let saved: Theme = 'dark';
    try {
      const v = localStorage.getItem('theme');
      if (v === 'light' || v === 'dark' || v === 'outdoors') saved = v;
    } catch {
      // ignore
    }
    get().setTheme(saved);
  },
}));
