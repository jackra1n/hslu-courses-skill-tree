<script lang="ts">
	import 'virtual:uno.css';
	import '$lib/styles/theme.css';
	import favicon from '$lib/assets/favicon.svg';
	import { getTheme, themeStore } from '$lib/stores/theme.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => {
		themeStore.init();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}
