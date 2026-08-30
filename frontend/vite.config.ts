import { sveltekit } from '@sveltejs/kit/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import UnoCSS from 'unocss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit(),
		UnoCSS(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			strategy: ['localStorage', 'preferredLanguage', 'baseLocale'],
		}),
	],
	server: {
		proxy: {
			// Local dev: the Worker on 8787 serves /api/* while the browser stays
			// on http://localhost:5173, so Better Auth cookies match the frontend
			// origin. changeOrigin: false keeps the localhost:5173 Host header.
			'/api': {
				target: 'http://127.0.0.1:8787',
				changeOrigin: false,
			},
		},
	},
});
