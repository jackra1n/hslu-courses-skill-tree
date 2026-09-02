<script lang="ts">
import * as m from '$lib/paraglide/messages';
import { type Theme, theme, themeStore } from '$lib/stores/theme.svelte';
import Dropdown from './Dropdown.svelte';

const themeOptions = $derived([
	{
		value: 'system' as Theme,
		label: m.theme_system(),
		icon: 'i-lucide-monitor',
	},
	{
		value: 'light' as Theme,
		label: m.theme_light(),
		icon: 'i-lucide-sun',
	},
	{
		value: 'dark' as Theme,
		label: m.theme_dark(),
		icon: 'i-lucide-moon',
	},
]);

function selectTheme(selectedTheme: string) {
	themeStore.set(selectedTheme as Theme);
}
</script>

<Dropdown 
  options={themeOptions}
  selected={theme()}
  onSelect={selectTheme}
/>
