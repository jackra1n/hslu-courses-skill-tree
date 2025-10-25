<script lang="ts">
  interface Option {
    value: string;
    label: string;
    disabled?: boolean;
    tooltip?: string;
    keywords?: string[];
    icon?: string;
  }

  interface Props {
    options: Option[];
    selected: string;
    onSelect: (value: string) => void;
    placeholder?: string;
    minWidth?: string;
    searchPlaceholder?: string;
    noResultsText?: string;
    normalize?: (text: string) => string;
    filter?: (query: string, option: Option) => boolean;
  }

  let {
    options,
    selected,
    onSelect,
    placeholder = 'Select option',
    minWidth = 'auto',
    searchPlaceholder = 'Search...',
    noResultsText = 'No results found',
    normalize = (text: string) =>
      text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''),
    filter = (query: string, option: Option) => {
      const normalizedQuery = normalize(query);
      const searchTexts = [normalize(option.label), ...(option.keywords || []).map((k) => normalize(k))];
      return searchTexts.some((text) => text.includes(normalizedQuery));
    },
  }: Props = $props();

  let isOpen = $state(false);
  let searchQuery = $state('');
  let highlightedIndex = $state(-1);
  let comboboxElement: HTMLDivElement | undefined = $state();
  let inputElement: HTMLInputElement | undefined = $state();
  let listboxElement: HTMLUListElement | undefined = $state();

  const filteredOptions = $derived.by(() => {
    if (!searchQuery.trim()) return options;
    return options.filter((option) => filter(searchQuery, option));
  });

  const selectedOption = $derived.by(() => {
    return (
      options.find((option) => option.value === selected) || {
        value: '',
        label: placeholder,
      }
    );
  });

  function toggleCombobox() {
    if (isOpen) {
      closeCombobox();
    } else {
      openCombobox();
    }
  }

  function openCombobox() {
    isOpen = true;
    searchQuery = '';
    highlightedIndex = -1;
    // focus input after DOM update
    setTimeout(() => {
      inputElement?.focus();
    }, 0);
  }

  function closeCombobox() {
    isOpen = false;
    searchQuery = '';
    highlightedIndex = -1;
  }

  function selectOption(option: Option) {
    if (option.disabled) return;
    onSelect(option.value);
    closeCombobox();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!isOpen) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault();
        openCombobox();
      }
      return;
    }

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        closeCombobox();
        break;
      case 'ArrowDown':
        event.preventDefault();
        highlightedIndex = Math.min(highlightedIndex + 1, filteredOptions.length - 1);
        scrollToHighlighted();
        break;
      case 'ArrowUp':
        event.preventDefault();
        highlightedIndex = Math.max(highlightedIndex - 1, -1);
        scrollToHighlighted();
        break;
      case 'Enter':
        event.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          selectOption(filteredOptions[highlightedIndex]);
        }
        break;
      case 'Tab':
        closeCombobox();
        break;
    }
  }

  function scrollToHighlighted() {
    if (highlightedIndex >= 0 && listboxElement) {
      const highlightedElement = listboxElement.children[highlightedIndex] as HTMLElement;
      highlightedElement?.scrollIntoView({ block: 'nearest' });
    }
  }

  function handleInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    searchQuery = target.value;
    highlightedIndex = -1;
  }

  function handleClickOutside(event: MouseEvent) {
    if (comboboxElement && !comboboxElement.contains(event.target as Node)) {
      closeCombobox();
    }
  }

  function highlightText(text: string, query: string): string {
    if (!query.trim()) return text;

    const normalizedText = normalize(text);
    const normalizedQuery = normalize(query);
    const index = normalizedText.indexOf(normalizedQuery);

    if (index === -1) return text;

    const before = text.substring(0, index);
    const match = text.substring(index, index + query.length);
    const after = text.substring(index + query.length);

    return `${before}<mark class="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">${match}</mark>${after}`;
  }

  $effect(() => {
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  });

  // reset highlighted index when filtered options change
  $effect(() => {
    const _ = filteredOptions;
    highlightedIndex = Math.min(highlightedIndex, filteredOptions.length - 1);
  });
</script>

<div class="relative" bind:this={comboboxElement}>
  <button
    onclick={toggleCombobox}
    onkeydown={handleKeydown}
    class="flex items-center justify-between px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer w-full"
    style="min-width: {minWidth}"
    aria-label="Select option"
    aria-expanded={isOpen}
    aria-haspopup="listbox"
    aria-controls="combobox-listbox"
  >
    <div class="flex items-center gap-2 flex-1 text-left min-w-0">
      {#if selectedOption.icon}
        <div class="{selectedOption.icon} w-4 h-4 flex-shrink-0"></div>
      {/if}
      <span class="text-sm font-medium truncate">{selectedOption.label}</span>
    </div>
    <div
      class="i-lucide-chevron-down w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 {isOpen
        ? 'rotate-180'
        : ''} flex-shrink-0"
    ></div>
  </button>

  {#if isOpen}
    <div class="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
      <div class="p-2 border-b border-gray-200 dark:border-gray-700 rounded-t-lg">
        <input
          bind:this={inputElement}
          type="text"
          placeholder={searchPlaceholder}
          value={searchQuery}
          oninput={handleInputChange}
          onkeydown={handleKeydown}
          class="w-full px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Search options"
          aria-autocomplete="list"
          aria-controls="combobox-listbox"
        />
      </div>

      <ul
        bind:this={listboxElement}
        id="combobox-listbox"
        role="listbox"
        class="max-h-60 overflow-y-auto rounded-b-lg"
        aria-label="Options"
      >
        {#each filteredOptions as option, index (option.value)}
          <li
            role="option"
            aria-selected={option.value === selected}
            onclick={() => selectOption(option)}
            onkeydown={(e) => e.key === "Enter" && selectOption(option)}
            tabindex="-1"
            class="flex items-center gap-2 px-3 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer {index ===
            highlightedIndex
              ? 'bg-gray-100 dark:bg-gray-700'
              : ''} {option.disabled
              ? 'opacity-50 cursor-not-allowed'
              : ''} {option.value === selected
              ? 'bg-gray-100 dark:bg-gray-700'
              : ''}"
          >
            {#if option.icon}
              <div class="{option.icon} w-4 h-4 flex-shrink-0"></div>
            {/if}
            <span
              class="text-sm font-medium flex-1 {option.value === selected
                ? 'font-semibold'
                : ''}"
            >
              {@html highlightText(option.label, searchQuery)}
            </span>
            {#if option.disabled}
              <div class="i-lucide-lock w-4 h-4 text-gray-400 flex-shrink-0"></div>
            {:else if option.value === selected}
              <div class="i-lucide-check w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0"></div>
            {/if}
          </li>
        {/each}

        {#if filteredOptions.length === 0}
          <li class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">
            {noResultsText}
          </li>
        {/if}
      </ul>
    </div>
  {/if}
</div>
