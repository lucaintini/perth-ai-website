import { defineConfig } from '@playwright/test';
// Serves public/ so /ddd-2026/?booth loads as in production.
export default defineConfig({
  testDir: 'tests/rotation',
  timeout: 45000,
  use: { baseURL: 'http://127.0.0.1:4321' },
  webServer: {
    command: 'npx --yes http-server public -p 4321 -s',
    url: 'http://127.0.0.1:4321/ddd-2026/?booth',
    reuseExistingServer: false,
    timeout: 60000,
  },
});
