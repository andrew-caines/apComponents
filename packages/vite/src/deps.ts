import { fileURLToPath } from 'node:url'

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
