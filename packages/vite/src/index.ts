import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import type { PluginOption, UserConfig } from 'vite'

export { AP_ALIASED_DEPS, AP_BUNDLED_DEPS } from './deps.js'

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

/**
 * The CSS browser floor `:dir()` needs; lower targets make lightningcss
 * rewrite it to `:lang()`.
 *
 * Vite minifies client CSS with lightningcss against `build.cssTarget`, which
 * defaults to a chrome111 floor. `:dir()` needs chrome120, so at the default
 * the minifier rewrites `:dir(rtl)` into `:is(:lang(ae),:lang(ar),...)` and
 * RTL styling then follows the page language instead of direction. This is
 * the same list as Vite's default with chrome and edge raised to 120.
 *
 * `apComponents()` applies it only when the consumer set neither
 * `build.cssTarget` nor `build.target`. An explicit `build.target` is
 * respected, because Vite derives `cssTarget` from it. The `es20xx` targets
 * up to `es2024` map to Chrome versions below 120 (`es2024` is chrome119 in
 * Vite 8's map), so they lower `:dir()`, and `ap-components:rtl-check` warns. The `config` hook's `user` argument
 * includes the config of plugins listed earlier, so a target set by one of
 * those also counts as the consumer's. Gate 6's `:dir(rtl)` assertion on the
 * built fixture is the backstop.
 */
export const AP_CSS_TARGET: readonly string[] = ['chrome120', 'edge120', 'firefox114', 'safari16.4', 'ios16.4']

// The start of lightningcss's `:is(:lang(ae),:lang(ar),...,:lang(yi))`.
const LOWERED_DIR = /:lang\(ae\),:lang\(ar\)/

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
      // `build.cssTarget` is defaulted only when the consumer set neither it
      // nor `build.target` (which Vite derives `cssTarget` from), because
      // Vite's lightningcss minify would otherwise lower `:dir()` to `:lang()`
      // at its chrome111 default (see `AP_CSS_TARGET`). A consumer's own value
      // is respected; `ap-components:rtl-check` warns if it lowers. `user`
      // includes earlier plugins' config.
      config: (user: UserConfig) => ({
        ssr: { noExternal: [...AP_PACKAGES] },
        optimizeDeps: { exclude: [...AP_PACKAGES] },
        ...(user.build?.cssTarget === undefined && user.build?.target === undefined
          ? { build: { cssTarget: [...AP_CSS_TARGET] } }
          : {}),
      }),
    },
    {
      name: 'ap-components:rtl-check',
      // Post, so it sees the CSS after the minifier has run.
      enforce: 'post',
      apply: 'build',
      generateBundle(_, bundle) {
        for (const asset of Object.values(bundle)) {
          if (asset.type !== 'asset' || !asset.fileName.endsWith('.css')) continue
          // The shape lightningcss lowers `:dir(rtl)` to. A bare `:lang(ae)` in a
          // consumer's own CSS is not a lowered `:dir()`, and does not warn.
          if (!LOWERED_DIR.test(String(asset.source))) continue
          this.warn(
            '@ap/vite: a :dir() rule was lowered to :lang(), so RTL styling will follow the page language instead of direction. Set build.cssTarget to AP_CSS_TARGET (exported from @ap/vite) or newer.',
          )
          return
        }
      },
    },
  ]
}
