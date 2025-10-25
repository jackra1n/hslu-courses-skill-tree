import { browser } from '$app/environment';

export type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = Exclude<Theme, 'system'>;

const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: '#ffffff',
  dark: '#111827'
};

// private state
let _theme = $state<Theme>('light');

// export getter function
export function theme() { return _theme; }

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
  }
};

function applyTheme(themeValue: Theme) {
  if (!browser) return;
  
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolvedTheme: ResolvedTheme = themeValue === 'system'
    ? (prefersDark ? 'dark' : 'light')
    : themeValue;
  
  root.classList.toggle('dark', resolvedTheme === 'dark');
  root.style.colorScheme = resolvedTheme;
  updateMetaThemeColor(resolvedTheme);
}

function updateMetaThemeColor(themeValue: ResolvedTheme) {
  const metaTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!metaTheme) return;

  metaTheme.setAttribute('content', THEME_COLORS[themeValue]);
}

if (browser) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (_e) => {
    const currentTheme = localStorage.getItem('theme') as Theme;
    if (currentTheme === 'system') {
      applyTheme('system');
    }
  });
}
