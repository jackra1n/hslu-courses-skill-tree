<script lang="ts">
import * as m from '$lib/paraglide/messages';
</script>

<div class="flex h-screen h-dvh flex-col overflow-hidden font-sans">
	<header
		class="flex items-center justify-between gap-3 border-b border-border-primary bg-bg-primary px-4 py-2 lg:gap-4 lg:py-3"
	>
		<div class="min-w-0 leading-tight">
			<h1 class="text-lg font-semibold text-text-primary lg:hidden">{m.header_title_short()}</h1>
			<h1 class="hidden text-lg font-semibold text-text-primary lg:block">{m.header_title()}</h1>
			<p class="hidden text-xs text-text-secondary lg:block">{m.header_subtitle()}</p>
		</div>
		<div
			class="flex items-center gap-2 motion-safe:animate-pulse [&>div]:rounded-lg [&>div]:bg-bg-secondary"
			aria-hidden="true"
		>
			<div class="hidden h-9 w-28 lg:block"></div>
			<div class="h-11 w-11 lg:h-9 lg:w-28"></div>
			<div class="h-11 w-24 lg:h-9"></div>
			<div class="h-11 w-11 lg:hidden"></div>
			<div class="hidden h-9 w-28 lg:block"></div>
			<div class="hidden h-9 w-9 lg:block"></div>
		</div>
	</header>
	<div class="min-h-0 flex-1 xl:grid xl:grid-cols-[1fr_400px]">
		<div></div>
		<div class="hidden border-l border-border-primary bg-bg-secondary xl:block"></div>
	</div>
	<p class="sr-only" role="status">{m.page_loading_catalog()}</p>
</div>
