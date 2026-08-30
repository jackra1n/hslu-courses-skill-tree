<script lang="ts">
import 'virtual:uno.css';
import '$lib/styles/theme.css';
import favicon from '$lib/assets/icon.png';
import GuidedTutorial from '$lib/components/ui/GuidedTutorial.svelte';
import MobileWarningPopup from '$lib/components/ui/MobileWarningPopup.svelte';
import * as messages from '$lib/paraglide/messages';

let { children } = $props();
</script>

<svelte:head>
	<title>{messages.layout_title()}</title>
	<meta name="description" content={messages.layout_description()} />
	<link rel="icon" type="image/png" href={favicon} />
	<link rel="apple-touch-icon" href={favicon} />
</svelte:head>

{@render children?.()}

<MobileWarningPopup />
<GuidedTutorial />
