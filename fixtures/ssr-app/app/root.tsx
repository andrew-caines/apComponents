import { useEffect } from 'react'
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router'
import '@ap/react/fonts.css'
import '@ap/react/theme.css'
// Load-bearing now that a component animates: Dialog's enter/exit and Spinner's
// rotation are `animation: var(--ap-motion-*)`, which resolves to nothing
// without this. See docs/CONTRIBUTING.md, "Motion".
import '@ap/react/motion.css'

export default function Root() {
  useEffect(() => {
    // Test affordance only, not a library concern: an effect runs exclusively
    // on the client, after hydration completes, so this gives Playwright's
    // hydration gate (fixtures/ssr-app/e2e/hydration.spec.ts) a positive
    // "hydration is done" signal to wait on instead of an arbitrary sleep.
    document.documentElement.dataset.apHydrated = 'true'
  }, [])

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}
