import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import type { PluginOption } from 'vite'

/**
 * Packages whose source the consumer compiles. They must be bundled rather
 * than externalised, or an SSR build never runs the vanilla-extract
 * transform over their `.css.ts` files — and `@ap/motion`, whose `.` export
 * is raw TypeScript, would not even parse. See ADR-0002.
 *
 * Every workspace package a consumer imports belongs here; `index.test.ts`
 * enumerates `packages/` and fails if one is missing.
 */
export const AP_PACKAGES = ['@ap/react', '@ap/motion', '@ap/tokens'] as const

export interface ApComponentsOptions {
  /** Passed straight through to `vanillaExtractPlugin`. */
  vanillaExtract?: Parameters<typeof vanillaExtractPlugin>[0]
}

/**
 * Everything a product needs to consume apComponents from a vendored
 * submodule:
 *
 * ```ts
 * export default defineConfig({
 *   plugins: [reactRouter(), apComponents()],
 * })
 * ```
 */
export function apComponents(options: ApComponentsOptions = {}): PluginOption[] {
  return [
    vanillaExtractPlugin(options.vanillaExtract),
    {
      name: 'ap-components:config',
      config: () => ({
        ssr: { noExternal: [...AP_PACKAGES] },
        optimizeDeps: { exclude: [...AP_PACKAGES] },
      }),
    },
  ]
}
