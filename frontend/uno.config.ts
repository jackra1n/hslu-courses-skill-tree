import { defineConfig, presetIcons, presetTypography, presetWebFonts, presetWind4 } from 'unocss';

export default defineConfig({
  presets: [
    presetWind4(),
    presetTypography(),
    presetIcons({
      scale: 1.2,
      warn: true,
      collections: {
        lucide: () => import('@iconify-json/lucide/icons.json').then((i) => i.default),
      },
    }),
    presetWebFonts({
      provider: 'google',
      fonts: {
        sans: 'Inter:400,500,600,700',
        mono: 'JetBrains Mono:400,500',
      },
    }),
  ],
  theme: {
    colors: {
      // semantic color tokens for theme switching
      'bg-primary': 'rgb(var(--bg-primary))',
      'bg-secondary': 'rgb(var(--bg-secondary))',
      'text-primary': 'rgb(var(--text-primary))',
      'text-secondary': 'rgb(var(--text-secondary))',
      'text-tertiary': 'rgb(var(--text-tertiary))',
      'border-primary': 'rgb(var(--border-primary))',
      'border-secondary': 'rgb(var(--border-secondary))',
      'node-completed-bg': 'rgb(var(--node-completed-bg))',
      'node-completed-border': 'rgb(var(--node-completed-border))',
      'node-attended-bg': 'rgb(var(--node-attended-bg))',
      'node-attended-border': 'rgb(var(--node-attended-border))',
      'node-available-bg': 'rgb(var(--node-available-bg))',
      'node-available-border': 'rgb(var(--node-available-border))',
      'node-locked-bg': 'rgb(var(--node-locked-bg))',
      'node-locked-border': 'rgb(var(--node-locked-border))',
      'node-locked-text': 'rgb(var(--node-locked-text))',
    },
  },
});
