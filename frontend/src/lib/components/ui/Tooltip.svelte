<script lang="ts">
  import { fly } from 'svelte/transition';

  let { children, text, align = 'center' }: {
    children?: import('svelte').Snippet;
    text: string;
    align?: 'center' | 'start' | 'end';
  } = $props();

  let open = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const positions = {
    center: 'left-1/2 -translate-x-1/2',
    start: 'left-0',
    end: 'right-0'
  };

  function show() {
    clearTimeout(timer);
    timer = setTimeout(() => (open = true), 150);
  }

  function hide() {
    clearTimeout(timer);
    open = false;
  }
</script>

<span
  class="relative inline-flex"
  role="group"
  onpointerenter={show}
  onpointerleave={hide}
  onfocusin={show}
  onfocusout={hide}
>
  {@render children?.()}

  {#if open}
    <span
      role="tooltip"
      class="pointer-events-none absolute top-full z-50 mt-2 whitespace-nowrap rounded-lg border border-border-primary bg-bg-primary px-3 py-1.5 text-sm font-medium text-text-primary shadow-xl {positions[align]}"
      transition:fly={{ y: -4, duration: 120 }}
    >
      <span class="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-l border-t border-border-primary bg-bg-primary"></span>
      {text}
    </span>
  {/if}
</span>