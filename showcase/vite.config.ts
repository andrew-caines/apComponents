import { reactRouter } from '@react-router/dev/vite'
import { apComponents } from '@ap/vite'
import { defineConfig } from 'vite'

const isWin = process.platform === 'win32'

export default defineConfig({
  plugins: [reactRouter(), apComponents()],
  // Drive-letter casing artifact on Windows checkouts (D:\DEV vs d:\dev)
  // that breaks vanilla-extract's symlink resolution. See CONTRIBUTING.
  resolve: isWin ? { preserveSymlinks: true } : undefined,
})
