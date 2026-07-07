import { defineConfig, devices } from '@playwright/test';

// Run with: npm run test:e2e
// Requires BOTH the backend (uvicorn) and the frontend dev server running —
// see the README notes shipped alongside this file for exact commands.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // tests register real users against a real backend; keep serial to avoid cross-test noise
  retries: 0,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});