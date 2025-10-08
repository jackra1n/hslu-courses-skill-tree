import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark' | 'system';

function createThemeStore() {
  const { subscribe, set } = writable<Theme>('light');

  return {
    subscribe,
    set: (theme: Theme) => {
      if (browser) {
        localStorage.setItem('theme', theme);
        applyTheme(theme);
      }
      set(theme);
    },
    init: () => {
      if (!browser) return;
      
      const stored = localStorage.getItem('theme') as Theme;
      const theme = stored || 'light';
      set(theme);
      applyTheme(theme);
    }
  };
}

function applyTheme(theme: Theme) {
  if (!browser) return;
  
  const root = document.documentElement;
  
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  } else {
    root.classList.toggle('dark', theme === 'dark');
  }
}

export const theme = createThemeStore();

// Listen for system theme changes
if (browser) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (_e) => {
    const currentTheme = localStorage.getItem('theme') as Theme;
    if (currentTheme === 'system') {
      applyTheme('system');
    }
  });
}
