import { reactRouter } from '@react-router/dev/vite'
import { apComponents } from '@ap/vite'
import { defineConfig } from 'vite'

// The whole of a consumer's apComponents setup. The external-consumer check
// fails if an app needs anything more than this.
export default defineConfig({ plugins: [reactRouter(), apComponents()] })
