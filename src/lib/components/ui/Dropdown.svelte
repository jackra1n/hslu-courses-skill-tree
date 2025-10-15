<script lang="ts">
  interface Option {
    value: string;
    label: string;
    disabled?: boolean;
    tooltip?: string;
    icon?: string;
  }

  interface Props {
    options: Option[];
    selected: string;
    onSelect: (value: string) => void;
    placeholder?: string;
  }

  let { options, selected, onSelect, placeholder = "Select option" }: Props = $props();

  let isOpen = $state(false);
  // @ts-ignore - assigned by bind:this
  let dropdownElement!: HTMLDivElement;

  function toggleDropdown() {
    isOpen = !isOpen;
  }

  function selectOption(option: Option) {
    if (option.disabled) return;
    onSelect(option.value);
    isOpen = false;
  }

  function handleClickOutside(event: MouseEvent) {
    if (dropdownElement && !dropdownElement.contains(event.target as Node)) {
      isOpen = false;
    }
  }

  $effect(() => {
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  });

  const getCurrentOption = $derived.by(() => {
    return options.find(option => option.value === selected) || { value: '', label: placeholder };
  });
</script>

<div class="relative" bind:this={dropdownElement}>
  <button
    onclick={toggleDropdown}
    class="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
    aria-label="Select option"
    aria-expanded={isOpen}
  >
    {#if getCurrentOption.icon}
      <div class="{getCurrentOption.icon} w-4 h-4"></div>
    {/if}
    <span class="text-sm font-medium">{getCurrentOption.label}</span>
    <div class="i-lucide-chevron-down w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 {isOpen ? 'rotate-180' : ''}"></div>
  </button>

  {#if isOpen}
    <div class="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
      {#each options as option (option.value)}
        <button
          onclick={() => selectOption(option)}
          class="w-full flex items-center gap-2 px-3 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg {option.value === selected ? 'bg-gray-100 dark:bg-gray-700' : ''} {option.disabled ? 'opacity-50 cursor-not-allowed' : ''}"
          disabled={option.disabled}
          title={option.tooltip}
        >
          {#if option.icon}
            <div class="{option.icon} w-4 h-4"></div>
          {/if}
          <span class="text-sm font-medium">{option.label}</span>
          {#if option.disabled}
            <div class="i-lucide-lock w-4 h-4 ml-auto text-gray-400"></div>
          {:else if option.value === selected}
            <div class="i-lucide-check w-4 h-4 ml-auto text-blue-500 dark:text-blue-400"></div>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
