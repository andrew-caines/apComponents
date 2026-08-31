import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:3112' },
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://127.0.0.1:3112',
    env: { PORT: '3112' },
    timeout: 180_000,
    reuseExistingServer: false,
  },
})
