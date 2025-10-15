<script lang="ts">
	import 'virtual:uno.css';
	import '$lib/styles/theme.css';
	import { themeStore } from '$lib/stores/theme.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => {
		themeStore.init();
	});
</script>

<svelte:head>
	<title>HSLU Course Skill Tree - Interactive Course Planning</title>
	<meta name="description" content="Interactive skill tree visualization for HSLU courses. Plan your academic journey with prerequisite tracking and course progression." />
	<link rel="icon" type="image/png" href="/icon.png" />
	<link rel="apple-touch-icon" href="/icon.png" />
</svelte:head>

{@render children?.()}
