import { defineConfig } from '@playwright/test'

export default defineConfig({
	testDir: './e2e',
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: 'http://127.0.0.1:5176/fleetops-platform/',
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure',
	},
	webServer: [
		{
			command: 'pnpm e2e:api',
			port: 4010,
			reuseExistingServer: false,
			timeout: 30_000,
		},
		{
			command: 'VITE_API_URL=http://127.0.0.1:4010/api VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= pnpm exec vite --host 127.0.0.1 --port 5176 --strictPort',
			url: 'http://127.0.0.1:5176/fleetops-platform/',
			reuseExistingServer: false,
			timeout: 30_000,
		},
	],
})
