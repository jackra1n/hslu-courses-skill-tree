<script lang="ts">
import { onMount } from 'svelte';
import 'virtual:uno.css';
import '$lib/styles/theme.css';
import AssessmentInfo from '$lib/components/ui/AssessmentInfo.svelte';
import SyncConflictDialog from '$lib/components/ui/SyncConflictDialog.svelte';
import * as m from '$lib/paraglide/messages';
import { localeStore } from '$lib/stores/locale.svelte';
import { themeStore } from '$lib/stores/theme.svelte';

let { children } = $props();

// global app initialization, runs once for every route: theme (dark class
// on <html>) and locale must not depend on individual pages calling init.
onMount(() => {
	localeStore.init();
	themeStore.init();
});
</script>

<svelte:head>
	<title>{m.layout_title()}</title>
	<meta name="description" content={m.layout_description()} />
</svelte:head>

{@render children?.()}
<AssessmentInfo />
<SyncConflictDialog />
