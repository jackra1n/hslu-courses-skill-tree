<script lang="ts">
  import { courseStore } from "$lib/stores/courseStore.svelte";

  let { data }: { data: { semester: number } } = $props();

  function handleClick(event: MouseEvent) {
    event.stopPropagation();
    courseStore.addCustomNode(data.semester);
  }
</script>

<button
  class="w-20 h-20 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-all cursor-pointer"
  onclick={handleClick}
  aria-label="Add course to semester {data.semester}"
  type="button"
>
  <div class="i-lucide-plus text-3xl text-gray-400 dark:text-gray-500"></div>
</button>
