<script lang="ts">
let { value, label }: { value: number; label: string } = $props();
const id = $props.id();
</script>

<span role="img" aria-label={label} title={label} class="inline-flex gap-0.5 text-blue-600 dark:text-blue-400">
	{#each [1, 2, 3, 4, 5] as score}
		{@const fill = Math.max(0, Math.min(1, value - score + 1)) * 100}
		<svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
			<defs>
				<linearGradient id={`${id}-${score}`}>
					<stop offset={`${fill}%`} stop-color="currentColor" />
					<stop offset={`${fill}%`} stop-color="transparent" />
				</linearGradient>
			</defs>
			<path d="m12 3 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.6l6.2-.9L12 3Z" fill={`url(#${id}-${score})`} stroke="currentColor" stroke-width="1.5" />
		</svg>
	{/each}
</span>
