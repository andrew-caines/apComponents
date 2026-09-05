import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import { playwright } from '@vitest/browser-playwright'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vanillaExtractPlugin()],
  test: {
    projects: [
      {
        // `extends: true` inherits the root `plugins` array. Without it the
        // vanilla-extract transform does not run and every .css.ts import
        // fails.
        extends: true,
        test: {
          name: 'unit',
          include: ['packages/*/src/**/*.test.{ts,tsx}'],
          setupFiles: ['./vitest.setup.ts'],
          // These two gates build fixture apps and boot a server. They run
          // under vitest.gates.config.ts via test:ssr / test:consumer, and
          // CI's unit job never installs fixture dependencies.
          exclude: [
            ...configDefaults.exclude,
            '**/ssr-render.gate.test.ts',
            '**/consumer-build.gate.test.ts',
          ],
        },
      },
      {
        extends: true,
        plugins: [storybookTest({ configDir: './storybook/.storybook' })],
        test: {
          name: 'storybook',
          // Leaving setupFiles unset lets the plugin compose preview.tsx and each
          // addon's own preview automatically, in the addon-then-preview order the
          // scalar a11y.test merge in preview.tsx relies on — so the ordering trap
          // that a hand-written setProjectAnnotations call could get backwards is no
          // longer reachable.
          browser: {
            enabled: true,
            headless: true,
            // An object from @vitest/browser-playwright, not the string
            // 'playwright' — Vitest 4 changed this.
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
