<script lang="ts">
import { assessmentModeLabel } from '$lib/data/assessment-mode';
import type { AssessmentMode } from '$lib/data/catalog-types';

let { modes }: { modes: readonly AssessmentMode[] } = $props();

const uniqueModes = $derived([...new Set(modes)]);
</script>

<ul class="flex flex-wrap gap-2">
	{#each uniqueModes as mode}
		<li
			class="rounded-full border border-border-primary bg-bg-primary px-3 py-1.5 text-sm text-text-secondary"
		>
			{assessmentModeLabel(mode)}
		</li>
	{/each}
</ul>
