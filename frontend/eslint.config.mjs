import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const files = ['**/*.{js,mjs,cjs,ts,svelte}'];

export default defineConfig([
	{
		ignores: [
			'**/node_modules/**',
			'**/.svelte-kit/**',
			'**/.wrangler/**',
			'**/.output/**',
			'**/.vercel/**',
			'**/.netlify/**',
			'**/build/**',
			'**/playwright-report/**',
			'**/test-results/**',
			'worker/env.d.ts',
			'e2e/env.d.ts',
			'hslu_data/**',
			'templates/**',
			'src/lib/paraglide/**',
			'project.inlang/cache/**',
			'vite.config.{js,ts}.timestamp-*',
		],
	},
	{ ...js.configs.recommended, files },
	...ts.configs.recommended.map((config) => ({ ...config, files })),
	...svelte.configs.recommended,
	{
		files,
		languageOptions: {
			parserOptions: {
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.svelte'],
				project: [
					'./tsconfig.json',
					'./tsconfig.e2e.json',
					'./worker/tsconfig.json',
					'./tsconfig.lint.json',
				],
			},
		},
		rules: {
			// Select type-aware correctness checks rather than a broad style/unsafe preset.
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/no-misused-promises': 'error',
			'@typescript-eslint/no-unused-private-class-members': 'error',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					ignoreRestSiblings: true,
				},
			],
		},
	},
	{
		files: ['src/**/*.{js,ts,svelte}'],
		languageOptions: { globals: globals.browser },
	},
	{
		files: [
			'scripts/**/*.ts',
			'test/**/*.ts',
			'*.config.{ts,js,mjs}',
			'e2e/**/*.ts',
			'worker/**/*.ts',
		],
		languageOptions: { globals: { ...globals.node, ...globals.bun } },
	},
	{
		files: ['worker/**/*.ts', 'e2e/frontend.ts'],
		languageOptions: { globals: globals.worker },
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: { parserOptions: { parser: ts.parser, svelteConfig } },
		rules: { 'prefer-const': 'off', 'svelte/prefer-const': 'error' },
	},
	{
		files: ['src/lib/stores/progressStore.svelte.ts'],
		rules: {
			// Progress updates replace the entire Map; per-entry SvelteMap tracking is unnecessary.
			'svelte/prefer-svelte-reactivity': 'off',
		},
	},
]);
