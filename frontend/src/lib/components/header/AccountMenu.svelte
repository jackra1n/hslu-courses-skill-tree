<script lang="ts">
import { onMount } from 'svelte';
import * as messages from '$lib/paraglide/messages';
import {
	cloudSyncStore,
	type SyncStatus,
} from '$lib/stores/cloudSyncStore.svelte';

let { onInteract }: { onInteract?: () => void } = $props();

let accountMenuOpen = $state(false);

function eventPathIncludesClass(event: MouseEvent, className: string): boolean {
	return event
		.composedPath()
		.some(
			(node) =>
				node instanceof HTMLElement && node.classList.contains(className),
		);
}

onMount(() => {
	const handleClickOutside = (event: MouseEvent) => {
		if (accountMenuOpen && !eventPathIncludesClass(event, 'account-menu')) {
			accountMenuOpen = false;
		}
	};
	const handleEscape = (event: KeyboardEvent) => {
		if (event.key === 'Escape') accountMenuOpen = false;
	};

	document.addEventListener('click', handleClickOutside);
	document.addEventListener('keydown', handleEscape);
	return () => {
		document.removeEventListener('click', handleClickOutside);
		document.removeEventListener('keydown', handleEscape);
	};
});

const user = $derived(cloudSyncStore.user);
const status = $derived(cloudSyncStore.status);
const errorMessage = $derived(cloudSyncStore.errorMessage);

function statusLabel(status: SyncStatus): string | null {
	switch (status) {
		case 'synced':
			return messages.account_status_saved();
		case 'saving':
			return messages.account_status_saving();
		case 'local':
			// signed in but not yet synced (dirty or offline): local copy is safe
			return user ? messages.account_status_saved_local() : null;
		case 'error':
			return errorMessage;
		case 'conflict':
			return messages.account_status_saved_local();
		default:
			return null;
	}
}

const syncStatusLabel = $derived(statusLabel(status));

function toggleAccountMenu() {
	accountMenuOpen = !accountMenuOpen;
	if (accountMenuOpen) onInteract?.();
}

async function handleSignIn() {
	accountMenuOpen = false;
	onInteract?.();
	await cloudSyncStore.signInWithGitHub();
}

async function handleSignOut() {
	accountMenuOpen = false;
	await cloudSyncStore.signOut();
}
</script>

<div class="relative account-menu" data-tour="account">
  {#if user}
    <button
      onclick={toggleAccountMenu}
      class="flex h-9 items-center gap-2 rounded-lg border border-border-primary bg-transparent px-2 py-2 text-text-primary hover:bg-bg-secondary hover:shadow-sm transition-all"
      aria-label={messages.account_menu()}
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
        class="fixed inset-x-4 top-[var(--app-header-height)] z-50 rounded-lg border border-border-primary bg-bg-primary p-3 shadow-2xl overflow-visible
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

        {#if syncStatusLabel}
          <div class="mb-1.5 flex items-start gap-2 rounded-md bg-bg-secondary px-2.5 py-2 text-xs text-text-secondary">
            <div class="i-lucide-cloud mt-0.5 h-4 w-4 flex-none text-text-secondary"></div>
            <span class="min-w-0 leading-5">{syncStatusLabel}</span>
          </div>
        {/if}

        <button
          onclick={handleSignOut}
          class="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary transition-colors"
        >
          <div class="i-lucide-log-out h-4 w-4"></div>
          <span>{messages.account_sign_out()}</span>
        </button>
      </div>
    {/if}
  {:else}
    <button
      onclick={toggleAccountMenu}
      class="flex h-9 items-center gap-2 rounded-lg border border-border-primary bg-transparent px-3 py-2 text-text-primary hover:bg-bg-secondary hover:shadow-sm transition-all"
      aria-label={messages.account_sign_in()}
      aria-expanded={accountMenuOpen}
    >
      <div class="i-lucide-user h-4 w-4 text-text-primary"></div>
      <span class="text-sm font-medium text-text-primary">{messages.account_sign_in()}</span>
    </button>

    {#if accountMenuOpen}
      <div
        class="fixed inset-x-4 top-[var(--app-header-height)] z-50 rounded-lg border border-border-primary bg-bg-primary p-3 shadow-2xl
               sm:absolute sm:inset-auto sm:top-full sm:right-0 sm:mt-1 sm:w-56 sm:shadow-lg"
      >
        <div class="px-1 pb-2 text-xs font-medium text-text-secondary">{messages.account_sign_in_with()}</div>
        <button
          onclick={handleSignIn}
          class="flex w-full items-center gap-3 rounded-lg bg-bg-secondary px-3 py-2.5 text-left text-sm font-medium text-text-primary transition-colors hover:bg-bg-secondary/80"
        >
          <div class="i-lucide-github h-4 w-4"></div>
          <span>{messages.account_continue_github()}</span>
        </button>
      </div>
    {/if}
  {/if}
</div>
