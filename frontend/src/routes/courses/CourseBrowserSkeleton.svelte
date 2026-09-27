<script lang="ts">
import { resolve } from '$app/paths';
import * as m from '$lib/paraglide/messages';

const rows = Array.from({ length: 10 }, (_, index) => index);
</script>

<div class="flex h-screen h-dvh flex-col overflow-hidden bg-bg-primary font-sans text-text-primary">
	<header class="shrink-0 border-b border-border-primary bg-bg-primary px-4 py-2 sm:py-3">
		<div class="mx-auto flex w-full max-w-[90rem] items-center justify-between gap-3">
			<a
				href={resolve('/')}
				class="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-text-secondary transition-all hover:bg-bg-secondary hover:text-text-primary"
			>
				<div class="i-lucide-arrow-left h-4 w-4 shrink-0"></div>
				<span class="truncate">{m.nav_skill_tree()}</span>
			</a>
			<div class="flex shrink-0 items-center gap-2 motion-safe:animate-pulse" aria-hidden="true">
				<div class="h-11 w-11 rounded-lg bg-bg-secondary sm:h-9 sm:w-24"></div>
				<div class="h-8 w-8 rounded-lg bg-bg-secondary"></div>
			</div>
		</div>
	</header>
	<main class="mx-auto flex min-h-0 w-full max-w-[90rem] flex-1 flex-col px-4 py-6">
		<div
			class="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:items-start lg:gap-8 xl:grid-cols-[16rem_minmax(0,1fr)_30rem]"
		>
			<div class="lg:col-start-2">
				<h1 class="text-2xl font-bold">{m.browser_title()}</h1>
				<p class="mt-1 text-sm text-text-secondary">{m.browser_description()}</p>
				<div class="motion-safe:animate-pulse [&>div]:rounded-lg [&>div]:bg-bg-secondary" aria-hidden="true">
					<div class="mt-4 h-10"></div>
					<div class="mt-3 h-11 lg:hidden"></div>
					<div class="mt-3 h-10"></div>
				</div>
			</div>
			<div
				class="hidden space-y-5 motion-safe:animate-pulse lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:block [&>div]:rounded-lg [&>div]:bg-bg-secondary"
				aria-hidden="true"
			>
				<div class="h-7 w-24"></div>
				<div class="h-16"></div>
				<div class="h-16"></div>
				<div class="h-56"></div>
				<div class="h-56"></div>
			</div>
			<div
				class="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden motion-safe:animate-pulse lg:col-start-2 lg:row-start-2 lg:mt-3 lg:self-stretch"
				aria-hidden="true"
			>
				<div class="h-5 w-32 shrink-0 rounded bg-bg-secondary"></div>
				<div class="mt-2 grid grid-cols-1 gap-2">
					{#each rows as row (row)}
						<div class="h-28 rounded-lg border border-border-primary bg-bg-secondary"></div>
					{/each}
				</div>
			</div>
			<div
				class="hidden rounded-xl border border-border-primary bg-bg-secondary xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:block xl:h-full"
			></div>
		</div>
	</main>
	<p class="sr-only" role="status">{m.browser_loading()}</p>
</div>
