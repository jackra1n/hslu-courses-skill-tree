<script lang="ts">
import { onMount } from 'svelte';
import { loadCatalog } from '$lib/data/catalog-loader';
import type { CatalogCourse } from '$lib/data/catalog-types';
import { courseLabel } from '$lib/data/course-label';
import { localeStore } from '$lib/stores/locale.svelte';

type Phase = 'loading' | 'ready' | 'error';

let phase = $state<Phase>('loading');
let courses = $state<CatalogCourse[]>([]);

async function load(): Promise<void> {
	phase = 'loading';
	try {
		localeStore.init();
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

<main class="mx-auto w-full max-w-5xl px-4 py-6 font-sans">
	<nav aria-label="Breadcrumb">
		<a href="/" class="text-sm underline">Skill Tree</a>
	</nav>

	<h1 class="mt-2 text-2xl font-bold">Course Browser</h1>
	<p class="mt-1 text-sm opacity-70">
		A discovery-oriented catalogue of all HSLU courses, complementing the
		dependency-oriented Skill Tree.
	</p>

	{#if phase === 'loading'}
		<p class="mt-6" role="status">Loading courses…</p>
	{:else if phase === 'error'}
		<p class="mt-6" role="alert">
			Could not load the course catalogue.
			<button type="button" class="underline" onclick={load}>
				Try again
			</button>
		</p>
	{:else}
		<p class="mt-4 text-sm opacity-70">
			{courses.length} courses
		</p>
		<ul class="mt-2 divide-y">
			{#each courses as course (course.id)}
				<li class="py-3">
					<article>
						<h2 class="font-semibold">{courseLabel(course)}</h2>
						<p class="text-sm opacity-70">
							{course.id} · {course.ects} ECTS
						</p>
					</article>
				</li>
			{/each}
		</ul>
	{/if}
</main>
