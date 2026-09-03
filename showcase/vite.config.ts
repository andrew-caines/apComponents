import { reactRouter } from '@react-router/dev/vite'
import { apComponents } from '@ap/vite'
import { defineConfig } from 'vite'

const isWin = process.platform === 'win32'

export default defineConfig({
  plugins: [reactRouter(), apComponents()],
  // Both of the settings below are workarounds for this repository's own
  // layout, not requirements of `@ap/vite`. A product installing `@ap/react`
  // from a registry needs neither. They are copied from
  // `fixtures/ssr-app/vite.config.ts`, where each is explained at length.
  //
  // Drive-letter casing artifact on Windows checkouts (D:\DEV vs d:\dev) that
  // breaks vanilla-extract's symlink resolution.
  resolve: isWin ? { preserveSymlinks: true } : undefined,
  // Every package in Base UI's chain that imports React has to land in the same
  // bundled chunk, or a second copy of React loads and every hook reads a null
  // dispatcher. `use-sync-external-store` is needed for Dialog specifically —
  // it is the first component with a Base UI store. Symptom if you drop one:
  // that component's route returns 500 while every other route returns 200.
  ssr: { noExternal: ['@base-ui/react', '@base-ui/utils', 'use-sync-external-store'] },
})
