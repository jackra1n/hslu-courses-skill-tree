<script lang="ts">
import type { ModuleType } from '$lib/data/catalog/catalog-types';
import {
	moduleTypeBadge,
	moduleTypeLabel,
} from '$lib/data/courses/module-type';

let {
	type,
	short = false,
	variant = 'subtle',
	size = 'sm',
}: {
	type: ModuleType;
	short?: boolean;
	variant?: 'solid' | 'subtle';
	size?: 'sm' | 'md';
} = $props();

const solidColor: Record<ModuleType, string> = {
	Kernmodul: 'border-blue-500 bg-blue-500 text-white',
	Projektmodul: 'border-orange-500 bg-orange-500 text-white',
	Erweiterungsmodul: 'border-green-500 bg-green-500 text-white',
	'Major-/Minormodul': 'border-purple-500 bg-purple-500 text-white',
	Zusatzmodul: 'border-yellow-500 bg-yellow-500 text-gray-950',
};

const subtleColor: Record<ModuleType, string> = {
	Kernmodul:
		'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
	Projektmodul:
		'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-300',
	Erweiterungsmodul:
		'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/50 dark:text-green-300',
	'Major-/Minormodul':
		'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/50 dark:text-purple-300',
	Zusatzmodul:
		'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-300',
};

const label = $derived(short ? moduleTypeBadge(type) : moduleTypeLabel(type));
const color = $derived(
	variant === 'solid' ? solidColor[type] : subtleColor[type],
);
</script>

<span
	class="inline-flex items-center rounded-md border font-medium {size === 'md' ? 'px-2.5 py-1 text-sm' : 'px-1.5 py-0.5 text-xs'} {color}"
>
	{label}
</span>
