<script lang="ts">
  import { onMount } from 'svelte';
  import { cloudSyncStore, type SyncStatus } from '$lib/stores/cloudSyncStore.svelte';

  let accountMenuOpen = $state(false);

  function eventPathIncludesClass(event: MouseEvent, className: string): boolean {
    return event.composedPath().some(
      (node) => node instanceof HTMLElement && node.classList.contains(className)
    );
  }

  onMount(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuOpen && !eventPathIncludesClass(event, 'account-menu')) {
        accountMenuOpen = false;
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  });

  const user = $derived(cloudSyncStore.user);
  const status = $derived(cloudSyncStore.status);
  const errorMessage = $derived(cloudSyncStore.errorMessage);

  function statusLabel(status: SyncStatus): string | null {
    switch (status) {
      case 'synced':
        return 'Saved';
      case 'saving':
        return 'Saving…';
      case 'local':
        // signed in but not yet synced (dirty or offline): local copy is safe
        return user ? 'Saved on this device' : null;
      case 'error':
        return errorMessage;
      case 'conflict':
        return 'Saved on this device';
      default:
        return null;
    }
  }

  async function handleSignIn() {
    await cloudSyncStore.signInWithGitHub();
  }

  async function handleSignOut() {
    accountMenuOpen = false;
    await cloudSyncStore.signOut();
  }
</script>

<div class="relative account-menu">
  {#if user}
    <button
      onclick={() => (accountMenuOpen = !accountMenuOpen)}
      class="flex h-9 items-center gap-2 rounded-lg border border-border-primary bg-transparent px-2 py-2 text-text-primary hover:bg-bg-secondary transition-colors"
      aria-label="Account menu"
      aria-expanded={accountMenuOpen}
    >
      {#if user.image}
        <img
          src={user.image}
          alt=""
          class="h-6 w-6 rounded-full object-cover"
          referrerpolicy="no-referrer"
        />
      {:else}
        <div class="i-lucide-user h-4 w-4 text-text-primary"></div>
      {/if}
      <span class="hidden sm:inline max-w-40 truncate text-sm font-medium text-text-primary">{user.name}</span>
    </button>

    {#if accountMenuOpen}
      <div
        class="fixed inset-x-4 top-[64px] z-50 rounded-lg border border-border-primary bg-bg-primary p-3 shadow-2xl overflow-visible
               sm:absolute sm:inset-auto sm:top-full sm:right-0 sm:mt-1 sm:w-64 sm:shadow-lg"
      >
        <div class="flex items-center gap-3 px-1 pb-3">
          {#if user.image}
            <img
              src={user.image}
              alt=""
              class="h-9 w-9 rounded-full object-cover"
              referrerpolicy="no-referrer"
            />
          {:else}
            <div class="flex h-9 w-9 items-center justify-center rounded-full bg-bg-secondary">
              <div class="i-lucide-user h-5 w-5 text-text-primary"></div>
            </div>
          {/if}
          <div class="min-w-0">
            <div class="truncate text-sm font-semibold text-text-primary">{user.name}</div>
            <div class="truncate text-xs text-text-secondary">{user.email}</div>
          </div>
        </div>

        <div class="border-b border-border-primary mb-2"></div>

        <div class="px-1 pb-1 text-xs text-text-secondary">
          {#if statusLabel(status)}
            <span class="i-lucide-cloud mr-1.5 inline-block h-3.5 w-3.5 align-[-2px]"></span>
            {statusLabel(status)}
          {/if}
        </div>

        <button
          onclick={handleSignOut}
          class="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary transition-colors"
        >
          <div class="i-lucide-log-out h-4 w-4"></div>
          <span>Sign out</span>
        </button>
      </div>
    {/if}
  {:else}
    <button
      onclick={handleSignIn}
      class="flex h-9 items-center gap-2 rounded-lg border border-border-primary bg-transparent px-3 py-2 text-text-primary hover:bg-bg-secondary transition-colors"
      aria-label="Sign in with GitHub"
    >
      <div class="i-lucide-user h-4 w-4 text-text-primary"></div>
      <span class="text-sm font-medium text-text-primary">Sign in</span>
    </button>
  {/if}
</div>
