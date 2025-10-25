import { browser } from '$app/environment';

export type Theme = 'light' | 'dark' | 'system';

// private state
let _theme = $state<Theme>('light');

// export getter function
export function theme() {
  return _theme;
}

export const themeStore = {
  set: (newTheme: Theme) => {
    if (browser) {
      localStorage.setItem('theme', newTheme);
      applyTheme(newTheme);
    }
    _theme = newTheme;
  },
  init: () => {
    if (!browser) return;

    const stored = localStorage.getItem('theme') as Theme;
    const newTheme = stored || 'light';
    _theme = newTheme;
    applyTheme(newTheme);
  },
};

function applyTheme(themeValue: Theme) {
  if (!browser) return;

  const root = document.documentElement;

  if (themeValue === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  } else {
    root.classList.toggle('dark', themeValue === 'dark');
  }
}

if (browser) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (_e) => {
    const currentTheme = localStorage.getItem('theme') as Theme;
    if (currentTheme === 'system') {
      applyTheme('system');
    }
  });
}
