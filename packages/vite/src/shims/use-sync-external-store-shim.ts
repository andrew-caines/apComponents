/**
 * Stands in for `use-sync-external-store/shim`, which on React 18+ only
 * re-exports React's own hook. Upstream is CommonJS, which Vite's dev SSR
 * runner cannot evaluate once inlined; this is ESM and imports the app's
 * `react`. `apComponents()` aliases the specifier here (see `deps.ts`).
 */
export { useSyncExternalStore } from 'react'
