import type { Config } from '@react-router/dev/config'

export default {
  // AP_SPA=1 builds the same app as a client-only SPA (ADR-0005).
  ssr: process.env['AP_SPA'] !== '1',
} satisfies Config
