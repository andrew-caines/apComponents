import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vanillaExtractPlugin()],
  test: {
    // packages only — fixture e2e specs belong to Playwright, not Vitest
    include: ['packages/*/src/**/*.test.{ts,tsx}'],
    // These two gates build a fixture app and boot a server. They are driven by
    // their own scripts (test:ssr, test:consumer) and their own CI jobs, so they
    // must not run inside the default `npm test`. They run instead under
    // vitest.gates.config.ts, which carries no such exclusion — keep both
    // files in sync if the gate filenames ever change.
    exclude: [
      ...configDefaults.exclude,
      '**/ssr-render.gate.test.ts',
      '**/consumer-build.gate.test.ts',
    ],
  },
})
