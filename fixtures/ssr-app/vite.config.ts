import { reactRouter } from '@react-router/dev/vite'
import { apComponents } from '@ap/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [reactRouter(), apComponents()],
  // Without this, Vite resolves the npm `file:` symlinks for @ap/react and
  // @ap/vite to their OS-reported real path before bundling. On this machine
  // that real path differs in drive-letter/segment casing from the path every
  // other tool uses (D:\DEV\... vs D:\dev\...), and the resulting case
  // mismatch makes @vanilla-extract/vite-plugin silently lose track of the
  // .css.ts modules it already compiled — Surface's own recipe CSS never
  // makes it into the built stylesheet even though the build succeeds and
  // the component's hashed classnames still show up in the HTML/JS. Verified
  // by isolated repro: importing Surface via a relative path (no symlink)
  // bundles its CSS correctly; importing the identical file via the bare
  // `@ap/react` specifier (through the node_modules symlink) drops it, and
  // preserveSymlinks:true restores it. See task-7-report.md for the full
  // diagnostic trail.
  resolve: {
    preserveSymlinks: true,
  },
})
