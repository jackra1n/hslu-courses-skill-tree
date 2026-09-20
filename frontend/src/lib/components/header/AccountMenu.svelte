<script lang="ts">
import { onMount } from 'svelte';
import * as m from '$lib/paraglide/messages';
import {
	cloudSyncStore,
	type SyncStatus,
} from '$lib/stores/cloudSyncStore.svelte';

let {
	onInteract,
	navigationMenu = false,
	accountMenuOpen = $bindable(false),
}: {
	onInteract?: () => void;
	navigationMenu?: boolean;
	accountMenuOpen?: boolean;
} = $props();

const triggerClass = $derived(
	navigationMenu
		? 'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-text-primary hover:bg-bg-secondary focus-visible:outline-blue-500 lg:min-h-9 lg:w-auto lg:gap-2 lg:border lg:border-border-primary'
		: 'flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-border-primary bg-transparent text-text-primary hover:bg-bg-secondary focus-visible:outline-blue-500 sm:h-9 sm:w-auto sm:px-3 sm:py-2',
);
const panelClass = $derived(
	navigationMenu
		? 'rounded-lg border border-border-primary bg-bg-primary p-3 lg:absolute lg:right-0 lg:top-full lg:mt-1 lg:w-64 lg:shadow-lg'
		: 'fixed inset-x-4 top-[var(--app-header-height)] z-50 rounded-lg border border-border-primary bg-bg-primary p-3 shadow-2xl sm:absolute sm:inset-auto sm:top-full sm:right-0 sm:mt-1 sm:w-64 sm:shadow-lg',
);

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
			return m.account_status_saved();
		case 'saving':
			return m.account_status_saving();
		case 'local':
			// signed in but not yet synced (dirty or offline): local copy is safe
			return user ? m.account_status_saved_local() : null;
		case 'error':
			return errorMessage;
		case 'conflict':
			return m.account_status_saved_local();
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
			class={triggerClass}
			aria-label={m.account_menu()}
			aria-expanded={accountMenuOpen}
		>
			{#if user.image}
				<img
					src={user.image}
					alt=""
					class="h-6 w-6 rounded-full object-cover"
					referrerpolicy="no-referrer"
				>
			{:else}
				<div class="i-lucide-user h-4 w-4 text-text-primary"></div>
			{/if}
			{#if navigationMenu}
				<span class="text-sm font-medium lg:hidden">{m.account_menu()}</span>
			{/if}
			<span
				class={`${navigationMenu ? 'hidden lg:inline' : 'hidden sm:inline'} max-w-40 truncate text-sm font-medium text-text-primary`}
				>{user.name}</span
			>
		</button>

		{#if accountMenuOpen}
			<div class={panelClass}>
				<div class="flex items-center gap-3 px-1 pb-3">
					{#if user.image}
						<img
							src={user.image}
							alt=""
							class="h-9 w-9 rounded-full object-cover"
							referrerpolicy="no-referrer"
						>
					{:else}
						<div
							class="flex h-9 w-9 items-center justify-center rounded-full bg-bg-secondary"
						>
							<div class="i-lucide-user h-5 w-5 text-text-primary"></div>
						</div>
					{/if}
					<div class="min-w-0">
						<div class="truncate text-sm font-semibold text-text-primary">
							{user.name}
						</div>
						<div class="truncate text-xs text-text-secondary">{user.email}</div>
					</div>
				</div>

				<div class="border-b border-border-primary mb-2"></div>

				{#if syncStatusLabel}
					<div
						class="mb-1.5 flex items-start gap-2 rounded-md bg-bg-secondary px-2.5 py-2 text-xs text-text-secondary"
					>
						<div
							class="i-lucide-cloud mt-0.5 h-4 w-4 flex-none text-text-secondary"
						></div>
						<span class="min-w-0 leading-5">{syncStatusLabel}</span>
					</div>
				{/if}

				<button
					onclick={handleSignOut}
					class="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary transition-colors"
				>
					<div class="i-lucide-log-out h-4 w-4"></div>
					<span>{m.account_sign_out()}</span>
				</button>
			</div>
		{/if}
	{:else}
		<button
			onclick={toggleAccountMenu}
			class={triggerClass}
			aria-label={m.account_sign_in()}
			aria-expanded={accountMenuOpen}
		>
			<div class="i-lucide-user h-4 w-4 text-text-primary"></div>
			<span
				class={`${navigationMenu ? '' : 'hidden sm:inline'} text-sm font-medium text-text-primary`}
				>{m.account_sign_in()}</span
			>
		</button>

		{#if accountMenuOpen}
			<div class={panelClass}>
				<div class="px-1 pb-2 text-xs font-medium text-text-secondary">
					{m.account_sign_in_with()}
				</div>
				<button
					onclick={handleSignIn}
					class="flex w-full items-center gap-3 rounded-lg bg-bg-secondary px-3 py-2.5 text-left text-sm font-medium text-text-primary transition-colors hover:bg-bg-secondary/80"
				>
					<div class="i-lucide-github h-4 w-4"></div>
					<span>{m.account_continue_github()}</span>
				</button>
			</div>
		{/if}
	{/if}
</div>
