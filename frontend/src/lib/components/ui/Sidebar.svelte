<script lang="ts">
import { onMount, type Snippet } from 'svelte';

let {
	isOpen,
	onClose,
	label,
	children,
}: {
	isOpen: boolean;
	onClose: () => void;
	label: string;
	children: Snippet;
} = $props();

onMount(() => {
	const handleEscape = (event: KeyboardEvent) => {
		if (event.key === 'Escape' && isOpen) onClose();
	};

	document.addEventListener('keydown', handleEscape);
	return () => document.removeEventListener('keydown', handleEscape);
});
</script>

<div
  class="fixed inset-x-0 top-[var(--app-header-height)] bottom-0 z-40 bg-black/40 transition-opacity duration-200 {isOpen
    ? 'opacity-100 pointer-events-auto'
    : 'opacity-0 pointer-events-none'}"
  onclick={onClose}
  aria-hidden={!isOpen}
></div>

<aside
  class="fixed top-[var(--app-header-height)] right-0 bottom-0 z-50 w-full max-w-md overflow-hidden border-l border-border-primary bg-bg-primary shadow-2xl transition-transform duration-200 ease-out {isOpen
    ? 'translate-x-0'
    : 'translate-x-full pointer-events-none'}"
  aria-label={label}
  aria-hidden={!isOpen}
>
  {@render children()}
</aside>
