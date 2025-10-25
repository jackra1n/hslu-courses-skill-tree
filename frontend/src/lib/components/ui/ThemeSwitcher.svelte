<script lang="ts">
  import { theme, themeStore, type Theme } from '$lib/stores/theme.svelte';
  import Dropdown from './Dropdown.svelte';

  const themeOptions = [
    { value: 'light' as Theme, label: 'Light', icon: 'i-lucide-sun' },
    { value: 'dark' as Theme, label: 'Dark', icon: 'i-lucide-moon' },
    { value: 'system' as Theme, label: 'System', icon: 'i-lucide-monitor' },
  ];

  function selectTheme(selectedTheme: string) {
    themeStore.set(selectedTheme as Theme);
  }
</script>

<Dropdown 
  options={themeOptions}
  selected={theme()}
  onSelect={selectTheme}
/>
