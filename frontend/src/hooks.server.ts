import type { Handle } from '@sveltejs/kit';
import { catalogAssetUrl } from '$lib/data/catalog/catalog-loader';

// With ssr disabled, <svelte:head> never reaches the prerendered HTML.
const catalogPreload = `<link rel="preload" as="fetch" type="application/json" href="${catalogAssetUrl}" crossorigin="anonymous">`;

export const handle: Handle = ({ event, resolve }) =>
	resolve(event, {
		transformPageChunk: ({ html }) => html.replace('</head>', `${catalogPreload}</head>`),
	});
