import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import { defineConfig } from 'vitest/config'

// A separate config for the fixture-building gates (ssr-render, consumer-build).
// vitest.config.ts deliberately excludes these two files from `npm test`
// (they build entire fixture apps and boot a server — minutes each — and
// CI's unit job never installs fixture dependencies). Vitest 3.2.7's CLI file
// filter cannot override a config-level `test.exclude` entry — passing the
// file's path to `vitest run` still yields "No test files found" — so
// test:ssr/test:consumer point at this config instead of layering more CLI
// flags onto the default one. This file carries no exclusion of its own.
export default defineConfig({
  plugins: [vanillaExtractPlugin()],
  test: {
    include: [
      'packages/react/src/gates/ssr-render.gate.test.ts',
      'packages/react/src/gates/consumer-build.gate.test.ts',
    ],
  },
})
