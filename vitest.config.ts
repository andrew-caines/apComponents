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
          // No custom setupFiles here, deliberately: @storybook/addon-vitest
          // auto-provisions the preview annotations (decorators, a11y
          // parameters) straight from `configDir` since Storybook 10.3. A
          // manual `setProjectAnnotations` call in a setup file at configDir
          // makes the plugin skip that auto-provisioning — but
          // `setProjectAnnotations` (from `@storybook/react-vite`) only
          // registers `globalThis.globalProjectAnnotations` for portable
          // stories' `composeStory`, not the project annotations this
          // harness's own story renderer reads. That mismatch silently
          // dropped every decorator, including `ApProvider` — proven via
          // Dialog.Dismiss throwing "useLocale must be used inside
          // <LocaleProvider>" even though the manual call reported 7
          // decorators registered. Leaving setupFiles unset lets the plugin
          // compose `storybook/.storybook/preview.tsx` and the a11y addon's
          // own preview automatically, in the addon-then-preview order the
          // scalar `a11y.test` merge in preview.tsx relies on.
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
