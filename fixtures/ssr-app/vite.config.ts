import { reactRouter } from '@react-router/dev/vite'
import { apComponents } from '@ap/vite'
import { defineConfig } from 'vite'

const isWin = process.platform === 'win32'

export default defineConfig({
  plugins: [reactRouter(), apComponents()],
  // Local workaround for a drive-letter casing artifact on this Windows
  // checkout (D:\DEV vs d:\dev) that breaks vanilla-extract's symlink
  // resolution — not a requirement of @ap/vite. See docs/CONTRIBUTING.md
  // § "Windows drive-letter casing breaks vanilla-extract silently".
  resolve: isWin ? { preserveSymlinks: true } : undefined,
  // Keep the client manifest instead of letting RR8 delete it after build —
  // the gate asserts the served HTML links this build's actual hashed asset
  // names, not just "a" .css file.
  build: { manifest: true },
  // Local workaround for this fixture's own duplicate-React problem, not a
  // requirement of @ap/vite: `@base-ui/react` is a dependency of `@ap/react`
  // (a workspace package), so it installs only under the repo ROOT
  // `node_modules`, never under this fixture's own. `@ap/vite`'s
  // `noExternal` already bundles `@ap/react`'s own source (see
  // packages/vite/src/index.ts), but that source's `import ... from
  // '@base-ui/react/...'` is left as a plain external import, resolved at
  // *runtime* from wherever the built server file sits
  // (fixtures/ssr-app/build/server/) — which walks up to the ROOT
  // node_modules' `react` copy. Meanwhile every other external `react`
  // import in the same built file resolves from this fixture's own
  // node_modules' `react` copy. Two different physical `react` modules load
  // into one Node process, and Base UI's `useId` (called through
  // `Field`/`Input`/`Button`) reads a null hook dispatcher from whichever
  // copy isn't currently rendering — confirmed by the exact stack trace
  // (`@base-ui/utils/useId.mjs` resolving `react` from the root
  // `node_modules`, `react-dom-server` resolving it from this fixture's).
  // Folding `@base-ui/react` into the same bundled chunk as `@ap/react`
  // collapses both `react` references into the single external import the
  // rest of the bundle already uses, so only one copy of React ever loads.
  // `@base-ui/utils` (the package `useId.mjs` actually lives in) needs the
  // same treatment: `@base-ui/react` depends on it as a separate package,
  // so bundling `@base-ui/react` alone still leaves `@base-ui/utils` as its
  // own external import, reintroducing the identical duplicate-React
  // problem one hop further down the dependency chain.
  ssr: { noExternal: ['@base-ui/react', '@base-ui/utils'] },
})
