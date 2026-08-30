import react from '@vitejs/plugin-react'
import { apComponents } from '@ap/vite'
import { defineConfig } from 'vite'

const isWin = process.platform === 'win32'

export default defineConfig({
  plugins: [react(), apComponents()],
  // Local workaround for a drive-letter casing artifact on this Windows
  // checkout (D:\DEV vs d:\dev) that breaks vanilla-extract's symlink
  // resolution — not a requirement of @ap/vite or @ap/react. See task-7-report.md.
  resolve: isWin ? { preserveSymlinks: true } : undefined,
})
