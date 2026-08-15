<script lang="ts">
import { fade, scale } from 'svelte/transition';
import {
	cloudSyncStore,
	type SyncConflict,
} from '$lib/stores/cloudSyncStore.svelte';

const conflict = $derived(cloudSyncStore.conflict);

function formatTime(timestamp: number | null): string {
	if (timestamp === null) return 'Unknown';
	return new Date(timestamp).toLocaleString(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short',
	});
}

function counts(data: SyncConflict['local']) {
	const statuses = Object.values(data.slotStatus);
	return {
		attended: statuses.filter((s) => s === 'attended').length,
		completed: statuses.filter((s) => s === 'completed').length,
		plans: Object.keys(data.studyPlans).length,
	};
}

// Deliberately no Escape/backdrop/close handling: the conflict must be
// resolved explicitly, never dismissed.
</script>

{#if conflict}
  <div
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    transition:fade={{ duration: 200 }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="sync-conflict-title"
  >
    <div
      class="w-full max-w-lg rounded-2xl border border-border-primary bg-bg-primary shadow-2xl"
      transition:scale={{ duration: 200, start: 0.95 }}
      role="document"
    >
      <!-- Header -->
      <div class="flex items-center gap-3 border-b border-border-primary px-6 py-4">
        <div class="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900">
          <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 id="sync-conflict-title" class="text-lg font-semibold text-text-primary">
          Choose which progress to keep
        </h2>
      </div>

      <!-- Content -->
      <div class="px-6 py-6 space-y-4">
        <p class="text-sm text-text-secondary leading-relaxed">
          This device and your cloud account have different progress. Pick one; the other stays saved
          on this device.
        </p>

        <div class="grid gap-3 sm:grid-cols-2">
          {#snippet card(title: string, icon: string, data: SyncConflict['local'], time: number | null)}
            <div class="rounded-xl border border-border-primary bg-bg-secondary p-4">
              <div class="flex items-center gap-2 mb-3">
                <div class="{icon} h-4 w-4 text-text-primary"></div>
                <div class="text-sm font-semibold text-text-primary">{title}</div>
              </div>
              <dl class="space-y-1.5 text-sm">
                <div class="flex justify-between gap-2">
                  <dt class="text-text-secondary">Updated</dt>
                  <dd class="text-text-primary">{formatTime(time)}</dd>
                </div>
                <div class="flex justify-between gap-2">
                  <dt class="text-text-secondary">Attended</dt>
                  <dd class="text-text-primary">{counts(data).attended}</dd>
                </div>
                <div class="flex justify-between gap-2">
                  <dt class="text-text-secondary">Completed</dt>
                  <dd class="text-text-primary">{counts(data).completed}</dd>
                </div>
                <div class="flex justify-between gap-2">
                  <dt class="text-text-secondary">Saved plans</dt>
                  <dd class="text-text-primary">{counts(data).plans}</dd>
                </div>
              </dl>
            </div>
          {/snippet}

          {@render card('This device', 'i-lucide-monitor', conflict.local, conflict.localUpdatedAt)}
          {@render card('Cloud data', 'i-lucide-cloud', conflict.cloud, conflict.cloudUpdatedAt)}
        </div>
      </div>

      <!-- Actions -->
      <div class="flex flex-col-reverse gap-3 border-t border-border-primary px-6 py-4 sm:flex-row sm:justify-end">
        <button
          class="rounded-lg border border-border-primary bg-bg-primary px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary transition-colors"
          onclick={() => cloudSyncStore.useLocalConflict()}
        >
          Use this device
        </button>
        <button
          class="rounded-lg px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          onclick={() => cloudSyncStore.useCloudConflict()}
        >
          Use cloud data
        </button>
      </div>
    </div>
  </div>
{/if}
