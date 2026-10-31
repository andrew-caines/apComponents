import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import { fileURLToPath } from 'node:url'
import type { PluginOption, UserConfig } from 'vite'

// The single-React lists live in this file, not a sibling module: a consumer's
// Vite config loads this source through Node's type stripping, which cannot
// follow a `./x.js` import to `./x.ts`, and a `./x.ts` import would fail the
// consumer's own typecheck. Keep this entry free of relative imports.


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
 * `@ap/react`'s own dependencies that import React, and how `apComponents()`
 * keeps each one on the app's single copy.
 *
 * The rule: every package in `@ap/react`'s chain that imports React must be
 * compiled into the same SSR bundle as `@ap/react`. One left as a plain
 * external import is resolved at runtime from wherever its files sit, and in
 * some install layouts that finds a second `react` — every hook then reads a
 * null dispatcher (`Cannot read properties of null (reading 'useId')`).
 * Bundled, its `react` import becomes the bundle's one bare `react`, which the
 * app resolves to its own copy. See docs/CONTRIBUTING.md, "second React".
 *
 * `deps.test.ts` walks `@ap/react`'s installed tree and fails, naming the
 * package, if a React importer is in neither list.
 */

/** Bundled into the SSR build (`ssr.noExternal`). */
export const AP_BUNDLED_DEPS: readonly string[] = ['@base-ui/react', '@base-ui/utils', '@floating-ui/react-dom']

/**
 * Replaced outright by ESM modules shipped in this package (`SHIM_ALIASES`).
 * `use-sync-external-store` is CommonJS, which Vite's dev SSR runner cannot
 * evaluate once inlined, and on React 19 it only re-exports React's own hook.
 */
export const AP_ALIASED_DEPS: readonly string[] = ['use-sync-external-store']

/**
 * Every bare specifier `@ap/react`'s runtime source imports from its own
 * dependencies, plus vanilla-extract's runtime for compiled recipes. Vite
 * cannot crawl `@ap/react` for these (it is in `optimizeDeps.exclude`, so its
 * `.css.ts` reach vanilla-extract), so without this list the dev client finds
 * them on the first page load, re-optimises and reloads the page. The preset
 * includes them as `@ap/react > <specifier>`, resolved from `@ap/react` itself.
 * `index.test.ts` re-reads the source and fails if this list drifts.
 */
export const AP_PREBUNDLE: readonly string[] = [
  '@base-ui/react/accordion',
  '@base-ui/react/alert-dialog',
  '@base-ui/react/button',
  '@base-ui/react/checkbox',
  '@base-ui/react/dialog',
  '@base-ui/react/field',
  '@base-ui/react/fieldset',
  '@base-ui/react/input',
  '@base-ui/react/merge-props',
  '@base-ui/react/popover',
  '@base-ui/react/radio',
  '@base-ui/react/radio-group',
  '@base-ui/react/select',
  '@base-ui/react/switch',
  '@base-ui/react/tabs',
  '@base-ui/react/toast',
  '@base-ui/react/tooltip',
  '@base-ui/utils/owner',
  '@base-ui/utils/useControlled',
  '@base-ui/utils/usePreviousValue',
  '@base-ui/utils/useStableCallback',
  '@base-ui/utils/useTimeout',
  '@base-ui/utils/useValueAsRef',
  '@vanilla-extract/recipes/createRuntimeFn',
]

const shim = (file: string): string => fileURLToPath(new URL(`./shims/${file}`, import.meta.url))

/**
 * Vite `resolve.alias` entries sending `use-sync-external-store`'s entry points
 * to this package's ESM replacements. Exact-match patterns, so `with-selector`
 * is never swallowed by the bare `shim` rule.
 */
export const SHIM_ALIASES: readonly { find: RegExp; replacement: string }[] = [
  { find: /^use-sync-external-store\/(shim\/)?with-selector(\.js)?$/, replacement: shim('with-selector.ts') },
  { find: /^use-sync-external-store\/shim(\/index(\.js)?)?$/, replacement: shim('use-sync-external-store-shim.ts') },
]

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
      //
      // One React (see `AP_BUNDLED_DEPS`): Base UI's React importers are bundled into
      // the SSR build, `use-sync-external-store` is swapped for ESM, React is
      // deduped, and `@ap/react`'s imports are pre-bundled for the dev client.
      // React itself is never bundled, so it always resolves to the app's copy.
      config: (user: UserConfig) => ({
        ssr: { noExternal: [...AP_PACKAGES, ...AP_BUNDLED_DEPS] },
        resolve: { dedupe: ['react', 'react-dom'], alias: [...SHIM_ALIASES] },
        optimizeDeps: {
          exclude: [...AP_PACKAGES],
          include: AP_PREBUNDLE.map((d) => `@ap/react > ${d}`),
        },
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
