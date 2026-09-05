<script lang="ts">
import { onMount } from 'svelte';
import 'virtual:uno.css';
import '$lib/styles/theme.css';
import favicon from '$lib/assets/icon.png';
import GuidedTutorial from '$lib/components/ui/GuidedTutorial.svelte';
import MobileWarningPopup from '$lib/components/ui/MobileWarningPopup.svelte';
import * as m from '$lib/paraglide/messages';
import { localeStore } from '$lib/stores/locale.svelte';
import { themeStore } from '$lib/stores/theme.svelte';

let { children } = $props();

// Global app initialization, runs once for every route: theme (dark class
// on <html>) and locale must not depend on individual pages calling init.
onMount(() => {
	localeStore.init();
	themeStore.init();
});
</script>

<svelte:head>
	<title>{m.layout_title()}</title>
	<meta name="description" content={m.layout_description()} />
	<link rel="icon" type="image/png" href={favicon} />
	<link rel="apple-touch-icon" href={favicon} />
</svelte:head>

{@render children?.()}

<MobileWarningPopup />
<GuidedTutorial />
