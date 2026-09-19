<script lang="ts" generics="Value extends string">
import * as m from '$lib/paraglide/messages';

interface Option {
	value: Value;
	label: string;
	disabled?: boolean;
	tooltip?: string;
	icon?: string;
	keywords?: string[];
}

const uniqueId = $props.id();

let {
	options,
	selected,
	onSelect,
	label,
	id = uniqueId,
	width = '100%',
	placeholder = m.dropdown_placeholder(),
	searchable = false,
	searchPlaceholder = m.dropdown_search(),
	noResultsText = m.dropdown_no_results(),
}: {
	options: Option[];
	selected: Value;
	onSelect: (value: Value) => void;
	label: string;
	id?: string;
	width?: string;
	placeholder?: string;
	searchable?: boolean;
	searchPlaceholder?: string;
	noResultsText?: string;
} = $props();

let isOpen = $state(false);
let query = $state('');
let activeIndex = $state(-1);
let trigger: HTMLButtonElement;
let popover: HTMLDivElement;
let searchInput: HTMLInputElement | undefined = $state();
let listbox: HTMLUListElement | undefined = $state();
let typedPrefix = '';
let lastTypedAt = 0;

function normalize(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '');
}

const normalizedQuery = $derived(normalize(query.trim()));
const filteredOptions = $derived(
	normalizedQuery
		? options.filter(
				(option) =>
					normalize(option.label).includes(normalizedQuery) ||
					option.keywords?.some((keyword) =>
						normalize(keyword).includes(normalizedQuery),
					),
			)
		: options,
);
const selectedOption = $derived(
	options.find((option) => option.value === selected),
);
const activeId = $derived(
	isOpen && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined,
);

function scrollToActive() {
	const option = document.getElementById(`${id}-option-${activeIndex}`);
	if (!option || !listbox) return;
	if (option.offsetTop < listbox.scrollTop) {
		listbox.scrollTop = option.offsetTop;
	} else if (
		option.offsetTop + option.offsetHeight >
		listbox.scrollTop + listbox.clientHeight
	) {
		listbox.scrollTop =
			option.offsetTop + option.offsetHeight - listbox.clientHeight;
	}
}

function open(preferLast = false) {
	query = '';
	typedPrefix = '';
	const current = options.findIndex(
		(option) => option.value === selected && !option.disabled,
	);
	activeIndex =
		current >= 0
			? current
			: preferLast
				? options.findLastIndex((option) => !option.disabled)
				: options.findIndex((option) => !option.disabled);
	isOpen = true;
}

function close(restoreFocus = false) {
	if (popover.matches(':popover-open')) popover.hidePopover();
	isOpen = false;
	query = '';
	typedPrefix = '';
	if (restoreFocus) trigger.focus({ preventScroll: true });
}

function selectOption(option: Option) {
	if (option.disabled) return;
	close(true);
	onSelect(option.value);
}

function move(direction: number) {
	const count = filteredOptions.length;
	for (let step = 1; step <= count; step++) {
		const index = (activeIndex + direction * step + count) % count;
		if (!filteredOptions[index].disabled) {
			activeIndex = index;
			return;
		}
	}
}

function typeAhead(event: KeyboardEvent) {
	const key = normalize(event.key);
	typedPrefix =
		event.timeStamp - lastTypedAt < 700 && typedPrefix !== key
			? typedPrefix + key
			: key;
	lastTypedAt = event.timeStamp;
	for (let step = 1; step <= filteredOptions.length; step++) {
		const index = (activeIndex + step) % filteredOptions.length;
		const option = filteredOptions[index];
		if (!option.disabled && normalize(option.label).startsWith(typedPrefix)) {
			activeIndex = index;
			return;
		}
	}
}

function handleKeydown(event: KeyboardEvent) {
	if (event.key === 'Tab') {
		if (isOpen) close(true);
		return;
	}
	if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
		event.preventDefault();
		if (isOpen) move(event.key === 'ArrowDown' ? 1 : -1);
		else open(event.key === 'ArrowUp');
	} else if (
		event.key === 'Enter' ||
		(event.key === ' ' && event.target === trigger)
	) {
		event.preventDefault();
		if (!isOpen) open();
		else if (activeIndex >= 0) selectOption(filteredOptions[activeIndex]);
	} else if (
		event.target === trigger &&
		(event.key === 'Home' || event.key === 'End')
	) {
		event.preventDefault();
		if (!isOpen) open();
		activeIndex =
			event.key === 'Home'
				? filteredOptions.findIndex((option) => !option.disabled)
				: filteredOptions.findLastIndex((option) => !option.disabled);
	} else if (
		!searchable &&
		event.key.length === 1 &&
		!event.ctrlKey &&
		!event.metaKey &&
		!event.altKey
	) {
		event.preventDefault();
		if (!isOpen) open();
		typeAhead(event);
	}
}

function updateQuery(event: Event) {
	query = (event.currentTarget as HTMLInputElement).value;
	activeIndex = filteredOptions.findIndex((option) => !option.disabled);
}

function position() {
	if (trigger.getClientRects().length === 0) {
		close();
		return;
	}
	const anchor = trigger.getBoundingClientRect();
	const viewport = window.visualViewport;
	const left = (viewport?.offsetLeft ?? 0) + 8;
	const top = (viewport?.offsetTop ?? 0) + 8;
	const right =
		left + (viewport?.width ?? document.documentElement.clientWidth) - 16;
	const bottom = top + (viewport?.height ?? window.innerHeight) - 16;
	const below = bottom - anchor.bottom - 4;
	const above = anchor.top - top - 4;
	popover.style.width = `${Math.min(anchor.width, right - left)}px`;
	popover.style.maxHeight = `${Math.min(320, Math.max(above, below, 0))}px`;
	const bounds = popover.getBoundingClientRect();
	popover.style.left = `${Math.max(left, Math.min(anchor.left, right - bounds.width))}px`;
	popover.style.top = `${below >= bounds.height || below >= above ? anchor.bottom + 4 : anchor.top - bounds.height - 4}px`;
}

$effect(() => {
	if (!isOpen) return;
	popover.showPopover();
	position();
	(searchable ? searchInput : trigger)?.focus({ preventScroll: true });
	const handleEscape = (event: KeyboardEvent) => {
		if (event.key !== 'Escape') return;
		// close this selector before an enclosing panel handles Escape.
		event.preventDefault();
		event.stopPropagation();
		close(true);
	};
	const handleScroll = (event: Event) => {
		if (!(event.target instanceof Node) || !popover.contains(event.target))
			position();
	};
	const observer = new ResizeObserver(position);
	observer.observe(trigger);
	observer.observe(popover);
	const viewport = window.visualViewport;
	document.addEventListener('keydown', handleEscape, true);
	document.addEventListener('scroll', handleScroll, true);
	window.addEventListener('resize', position);
	viewport?.addEventListener('resize', position);
	viewport?.addEventListener('scroll', position);
	return () => {
		observer.disconnect();
		document.removeEventListener('keydown', handleEscape, true);
		document.removeEventListener('scroll', handleScroll, true);
		window.removeEventListener('resize', position);
		viewport?.removeEventListener('resize', position);
		viewport?.removeEventListener('scroll', position);
	};
});

$effect(() => {
	if (!isOpen) return;
	if (!filteredOptions[activeIndex] || filteredOptions[activeIndex].disabled) {
		activeIndex = filteredOptions.findIndex((option) => !option.disabled);
	}
	scrollToActive();
});
</script>

<div class="min-w-0 max-w-full shrink-0" style:width>
	<button
		bind:this={trigger}
		{id}
		type="button"
		role={searchable ? undefined : 'combobox'}
		aria-label={label}
		aria-describedby={searchable ? `${id}-value` : undefined}
		aria-haspopup="listbox"
		aria-expanded={isOpen}
		aria-controls={isOpen ? `${id}-listbox` : undefined}
		aria-activedescendant={searchable ? undefined : activeId}
		onclick={() => isOpen ? close() : open()}
		onkeydown={handleKeydown}
		class="flex min-h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-text-primary hover:bg-bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
	>
		<span class="flex min-w-0 flex-1 items-center gap-2 text-left">
			{#if selectedOption?.icon}
				<span
					class="{selectedOption.icon} h-4 w-4 shrink-0"
					aria-hidden="true"
				></span>
			{/if}
			<span id={`${id}-value`} class="truncate text-sm font-medium"
				>{selectedOption?.label ?? placeholder}</span
			>
		</span>
		<span
			class="i-lucide-chevron-down h-4 w-4 shrink-0 text-text-secondary {isOpen ? 'rotate-180' : ''}"
			aria-hidden="true"
		></span>
	</button>

	<div
		bind:this={popover}
		popover="auto"
		ontoggle={(event) => { if (event.newState === 'closed') isOpen = false; }}
		class="fixed inset-auto m-0 overflow-hidden rounded-lg border border-border-primary bg-bg-primary text-text-primary shadow-xl"
	>
		{#if isOpen}
			{#if searchable}
				<div class="shrink-0 border-b border-border-primary p-2">
					<input
						bind:this={searchInput}
						type="text"
						role="combobox"
						value={query}
						oninput={updateQuery}
						onkeydown={handleKeydown}
						placeholder={searchPlaceholder}
						aria-label={`${label}: ${searchPlaceholder}`}
						aria-expanded="true"
						aria-autocomplete="list"
						aria-controls={`${id}-listbox`}
						aria-activedescendant={activeId}
						class="w-full rounded border border-border-secondary bg-bg-primary px-2 py-1.5 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
					>
				</div>
			{/if}
			<ul
				bind:this={listbox}
				id={`${id}-listbox`}
				role="listbox"
				aria-label={label}
				class="relative min-h-0 overflow-y-auto overscroll-contain p-1"
			>
				{#each filteredOptions as option, index (option.value)}
					{@const match = normalizedQuery ? normalize(option.label).indexOf(normalizedQuery) : -1}
					<li
						id={`${id}-option-${index}`}
						role="option"
						aria-selected={option.value === selected}
						aria-disabled={option.disabled || undefined}
						tabindex="-1"
						title={option.tooltip}
						onclick={() => selectOption(option)}
						onkeydown={handleKeydown}
						onpointermove={() => { if (!option.disabled) activeIndex = index; }}
						class="flex min-h-10 items-center gap-2 rounded-md px-2 py-2 text-sm {index === activeIndex ? 'bg-bg-secondary' : ''} {option.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}"
					>
						{#if option.icon}
							<span
								class="{option.icon} h-4 w-4 shrink-0"
								aria-hidden="true"
							></span>
						{/if}
						<span class="min-w-0 flex-1 break-words font-medium">
							{#if match >= 0}
								{option.label.slice(0, match)}
								<mark
									class="rounded bg-yellow-200 text-inherit dark:bg-yellow-800"
									>{option.label.slice(match, match + query.trim().length)}</mark
								>{option.label.slice(match + query.trim().length)}
							{:else}
								{option.label}
							{/if}
						</span>
						{#if option.disabled}
							<span
								class="i-lucide-lock h-4 w-4 shrink-0 text-text-tertiary"
								aria-hidden="true"
							></span>
						{:else if option.value === selected}
							<span
								class="i-lucide-check h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
								aria-hidden="true"
							></span>
						{/if}
					</li>
				{/each}
			</ul>
			{#if filteredOptions.length === 0}
				<p role="status" class="p-3 text-center text-sm text-text-secondary">
					{noResultsText}
				</p>
			{/if}
		{/if}
	</div>
</div>

<style>
[popover]:popover-open {
	display: flex;
	flex-direction: column;
}
</style>
