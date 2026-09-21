import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	// Public ubuntu-latest runners provide four vCPUs.
	workers: process.env.CI ? 4 : 2,
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
			// Navigation in this file only exists at the mobile breakpoint.
			testIgnore: /header-navigation\.spec\.ts/,
			use: {
				...devices['Desktop Chrome'],
				viewport: { width: 1440, height: 1000 },
			},
		},
		{
			name: 'mobile',
			// Avoid scheduling desktop-only tests and fixtures on the mobile project.
			grepInvert: /@desktop-only/,
			// Sync transitions use the desktop canvas; mobile conflict UI is covered elsewhere.
			testIgnore: /cloud-sync\.spec\.ts/,
			use: { ...devices['Pixel 7'] },
		},
	],
});
