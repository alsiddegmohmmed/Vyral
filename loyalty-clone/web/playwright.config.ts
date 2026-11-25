import { defineConfig, devices } from '@playwright/test';

// E2E suite for the loyalty clone. Runs against the already-running dev server
// (:3100) and the pglite dev database (:54321), which handles one query at a
// time per connection: so one worker, never parallel.
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-GB',
    timezoneId: 'Africa/Kigali',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, grepInvert: /@mobile-only/ },
    // 390 px phone: only the specs tagged @mobile (join, web card, scanner, dashboard layout)
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }, grep: /@mobile/ },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3100/login',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
