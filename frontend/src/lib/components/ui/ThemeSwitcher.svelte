<script lang="ts">
import * as messages from '$lib/paraglide/messages';
import { type Theme, theme, themeStore } from '$lib/stores/theme.svelte';
import Dropdown from './Dropdown.svelte';

const themeOptions = $derived([
	{
		value: 'system' as Theme,
		label: messages.theme_system(),
		icon: 'i-lucide-monitor',
	},
	{
		value: 'light' as Theme,
		label: messages.theme_light(),
		icon: 'i-lucide-sun',
	},
	{
		value: 'dark' as Theme,
		label: messages.theme_dark(),
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
