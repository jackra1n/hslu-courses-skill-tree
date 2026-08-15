<script lang="ts">
import 'virtual:uno.css';
import '$lib/styles/theme.css';
import favicon from '$lib/assets/icon.png';
import GuidedTutorial from '$lib/components/ui/GuidedTutorial.svelte';
import MobileWarningPopup from '$lib/components/ui/MobileWarningPopup.svelte';

let { children } = $props();
</script>

<svelte:head>
	<title>HSLU Courses Skill Tree - Interactive Course Planning</title>
	<meta name="description" content="Interactive skill tree visualization for HSLU courses. Plan your academic journey with prerequisite tracking and course progression." />
	<link rel="icon" type="image/png" href={favicon} />
	<link rel="apple-touch-icon" href={favicon} />
</svelte:head>

{@render children?.()}

<MobileWarningPopup />
<GuidedTutorial />
