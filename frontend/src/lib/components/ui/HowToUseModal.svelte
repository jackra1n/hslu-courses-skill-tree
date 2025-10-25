<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { showHowToGuide, uiStore } from '$lib/stores/uiStore.svelte';

  const steps = [
    {
      title: 'Navigate the tree',
      description: 'Pinch or drag to explore semesters. Tap a course node to see its details and prerequisites.'
    },
    {
      title: 'Track your progress',
      description: 'Use the action buttons in the course panel to mark courses as attended or completed.'
    },
    {
      title: 'Plan electives',
      description: 'Tap elective “Wahl-Modul” slots to pick courses and adjust your personalised plan.'
    }
  ];

  function closeModal() {
    uiStore.toggleHowToGuide();
  }
</script>

{#if showHowToGuide()}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    transition:fade={{ duration: 200 }}
    onclick={(event) => {
      if (event.target === event.currentTarget) {
        closeModal();
      }
    }}
    onkeydown={(event) => event.key === 'Escape' && closeModal()}
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    aria-labelledby="how-to-title"
  >
    <div
      class="w-full max-w-lg rounded-2xl border border-border-primary bg-bg-primary shadow-2xl"
      transition:scale={{ duration: 200, start: 0.95 }}
      role="document"
    >
      <div class="flex items-center justify-between border-b border-border-primary px-6 py-4">
        <h2 id="how-to-title" class="text-lg font-semibold text-text-primary">How to use HSLU Courses Skill Tree</h2>
        <button
          class="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-bg-secondary text-text-primary transition-colors"
          aria-label="Close how to modal"
          onclick={closeModal}
        >
          <div class="i-lucide-x w-4 h-4"></div>
        </button>
      </div>
      <div class="px-6 py-6 space-y-5">
        {#each steps as step, index}
          <div class="flex gap-4">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-semibold">
              {index + 1}
            </span>
            <div>
              <p class="font-semibold text-text-primary">{step.title}</p>
              <p class="text-sm text-text-secondary leading-relaxed">{step.description}</p>
            </div>
          </div>
        {/each}
      </div>
      <div class="flex justify-end border-t border-border-primary px-6 py-4">
        <button
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          onclick={closeModal}
        >
          Got it
        </button>
      </div>
    </div>
  </div>
{/if}
