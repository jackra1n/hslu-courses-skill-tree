<script lang="ts">
	import type { Locale } from '$lib/paraglide/runtime';
	import { locale, localeStore } from '$lib/stores/locale.svelte';
	import Dropdown from './Dropdown.svelte';

	const localeOptions = [
		{ value: 'en' as Locale, label: 'English', icon: 'i-lucide-languages' },
		{ value: 'de' as Locale, label: 'Deutsch', icon: 'i-lucide-languages' },
	];
</script>

<Dropdown
	options={localeOptions}
	selected={locale()}
	onSelect={(value) => localeStore.set(value as Locale)}
/>
