import type { Config } from '@react-router/dev/config'

const isSpa = process.env['AP_SPA'] === '1'

export default {
  // AP_SPA=1 builds the same app as a client-only SPA (ADR-0005).
  ssr: !isSpa,
  // Without this, RR8's SPA-mode build emits a generic bootstrap
  // `index.html` (a "Loading..." placeholder with no <Links/> output) rather
  // than the real prerendered shell, so the stylesheet <link> never appears
  // in the static file. Prerendering `/` renders root.tsx (and its <Links/>)
  // to real HTML at build time, which is what gate 7 asserts on.
  ...(isSpa ? { prerender: ['/'] } : {}),
} satisfies Config
