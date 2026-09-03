import { reactRouter } from '@react-router/dev/vite'
import { apComponents } from '@ap/vite'
import { defineConfig } from 'vite'

const isWin = process.platform === 'win32'

export default defineConfig({
  plugins: [reactRouter(), apComponents()],
  // The `resolve` settings and the `ssr.noExternal` list below are workarounds
  // for THIS repository's layout, not requirements of `@ap/vite`. A product
  // installing `@ap/react` from a registry needs none of them.
  resolve: {
    // One React, always. This app sits inside the workspace with its own
    // `node_modules`, so two physical copies are in scope — its own and the
    // repo root's — and any module resolving the wrong one reads a null hook
    // dispatcher.
    dedupe: ['react', 'react-dom'],
    // Drive-letter casing artifact on Windows checkouts (D:\DEV vs d:\dev)
    // that breaks vanilla-extract's symlink resolution. See CONTRIBUTING.
    ...(isWin ? { preserveSymlinks: true } : {}),
  },
  // Every package in Base UI's chain that imports React has to land in the same
  // bundled chunk, or a second copy loads and every hook reads a null
  // dispatcher. `use-sync-external-store` is needed for Dialog specifically —
  // it is the first component with a Base UI store. Symptom if one is missing:
  // that component's route returns 500 while every other route returns 200.
  //
  // This is also why the showcase is served from a BUILD rather than from
  // `react-router dev`: `use-sync-external-store` is CommonJS, Rollup converts
  // it during a build, and Vite's dev module runner does not — it evaluates the
  // inlined module as ESM, where the package's own `module.exports` throws
  // `module is not defined`. See docs/CONTRIBUTING.md, "The showcase".
  ssr: { noExternal: ['@base-ui/react', '@base-ui/utils', 'use-sync-external-store'] },
})
