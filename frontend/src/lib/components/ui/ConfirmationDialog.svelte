<script lang="ts">
  import { fade, scale } from 'svelte/transition';

  interface Props {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: 'danger' | 'warning';
  }

  let {
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    variant = 'danger'
  }: Props = $props();

  function handleEscape(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onCancel();
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onCancel();
    }
  }
</script>

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
  transition:fade={{ duration: 200 }}
  onclick={handleBackdropClick}
  onkeydown={handleEscape}
  tabindex="-1"
  role="dialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
>
  <div
    class="w-full max-w-md rounded-2xl border border-border-primary bg-bg-primary shadow-2xl"
    transition:scale={{ duration: 200, start: 0.95 }}
    role="document"
  >
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-border-primary px-6 py-4">
      <div class="flex items-center gap-3">
        {#if variant === 'danger'}
          <div class="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
            <svg class="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
        {:else}
          <div class="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900">
            <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
        {/if}
        <h2 id="dialog-title" class="text-lg font-semibold text-text-primary">{title}</h2>
      </div>
      <button
        class="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-bg-secondary text-text-primary transition-colors"
        aria-label="Close dialog"
        onclick={onCancel}
      >
        <div class="i-lucide-x w-4 h-4"></div>
      </button>
    </div>

    <!-- Content -->
    <div class="px-6 py-6">
      <p class="text-sm text-text-secondary leading-relaxed">{message}</p>
    </div>

    <!-- Actions -->
    <div class="flex justify-end gap-3 border-t border-border-primary px-6 py-4">
      <button
        class="rounded-lg border border-border-primary bg-bg-primary px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary transition-colors"
        onclick={onCancel}
      >
        {cancelText}
      </button>
      <button
        class="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors {variant === 'danger' 
          ? 'bg-red-600 hover:bg-red-700' 
          : 'bg-yellow-600 hover:bg-yellow-700'}"
        onclick={onConfirm}
      >
        {confirmText}
      </button>
    </div>
  </div>
</div>
