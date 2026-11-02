import { defineConfig } from '@playwright/test'
import base from './playwright.config.js'

/**
 * The same smoke test against `react-router dev` instead of a build. Dev SSR
 * inlines Base UI through Vite's module runner, which a build never exercises;
 * this is what proves "dev works for every component" (spec 2026-10-31).
 */
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: 'http://127.0.0.1:3130' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 3130 --strictPort',
    url: 'http://127.0.0.1:3130',
    timeout: 180_000,
    reuseExistingServer: false,
  },
})
