<script lang="ts">
import { onMount } from 'svelte';
import { loadCatalog } from '$lib/data/catalog-loader';
import type { CatalogCourse } from '$lib/data/catalog-types';
import { courseLabel } from '$lib/data/course-label';
import { localeStore } from '$lib/stores/locale.svelte';
import { themeStore } from '$lib/stores/theme.svelte';

type Phase = 'loading' | 'ready' | 'error';

let phase = $state<Phase>('loading');
let courses = $state<CatalogCourse[]>([]);

async function load(): Promise<void> {
	phase = 'loading';
	try {
		localeStore.init();
		themeStore.init();
		const catalog = await loadCatalog();
		courses = catalog.courses;
		phase = 'ready';
	} catch (error) {
		console.error('Failed to load course catalog', error);
		phase = 'error';
	}
}

onMount(() => {
	load();
});
</script>

<svelte:head>
	<title>Course Browser</title>
	<meta
		name="description"
		content="Browse all HSLU courses as a catalogue list."
	/>
</svelte:head>

<main class="min-h-screen bg-bg-primary font-sans text-text-primary">
	<div class="mx-auto w-full max-w-5xl px-4 py-6">
		<nav aria-label="Breadcrumb">
			<a href="/" class="text-sm text-text-secondary underline hover:text-text-primary">
				Skill Tree
			</a>
		</nav>

		<h1 class="mt-2 text-2xl font-bold">Course Browser</h1>
		<p class="mt-1 text-sm text-text-secondary">
			A discovery-oriented catalogue of all HSLU courses, complementing the
			dependency-oriented Skill Tree.
		</p>

		{#if phase === 'loading'}
			<p class="mt-6 text-text-secondary" role="status">Loading courses…</p>
		{:else if phase === 'error'}
			<p class="mt-6 text-text-primary" role="alert">
				Could not load the course catalogue.
				<button type="button" class="underline" onclick={load}>
					Try again
				</button>
			</p>
		{:else}
			<p class="mt-4 text-sm text-text-secondary">
				{courses.length} courses
			</p>
			<ul class="mt-2 grid gap-2 sm:grid-cols-2">
				{#each courses as course (course.id)}
					<li
						class="rounded-lg border border-border-primary bg-bg-secondary p-3"
					>
						<article class="flex items-start gap-3">
							<div class="i-lucide-book-open mt-0.5 shrink-0 text-text-tertiary"></div>
							<div class="min-w-0">
								<h2 class="truncate font-semibold">{courseLabel(course)}</h2>
								<p class="mt-0.5 text-sm text-text-secondary">
									{course.id} · {course.ects} ECTS
								</p>
							</div>
						</article>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</main>
