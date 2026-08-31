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
})
