import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	workers: 2,
	retries: 0,
	timeout: 30_000,
	reporter: [[process.env.CI ? 'github' : 'list'], ['html', { open: 'never' }]],
	use: {
		locale: 'en-US',
		timezoneId: 'Europe/Zurich',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
	},
	projects: [
		{
			name: 'desktop',
			use: {
				...devices['Desktop Chrome'],
				viewport: { width: 1440, height: 1000 },
			},
		},
		{
			name: 'mobile',
			use: { ...devices['Pixel 7'] },
		},
	],
});
