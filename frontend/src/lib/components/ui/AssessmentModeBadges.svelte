<script lang="ts">
import type { AssessmentMode } from '$lib/data/catalog-types';
import * as m from '$lib/paraglide/messages';

let { modes }: { modes: readonly AssessmentMode[] } = $props();

const uniqueModes = $derived([...new Set(modes)]);

function assessmentModeLabel(mode: AssessmentMode): string {
	switch (mode) {
		case 'coursework':
			return m.assessment_coursework();
		case 'written_exam':
			return m.assessment_written_exam();
		case 'oral_exam':
			return m.assessment_oral_exam();
		case 'electronic_exam':
			return m.assessment_electronic_exam();
	}
}
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
