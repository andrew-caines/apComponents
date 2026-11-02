import { useEffect } from 'react'
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router'
import '@ap/react/fonts.css'
import '@ap/react/theme.css'
import '@ap/react/motion.css'

export default function Root() {
  // Runs only on the client after hydration, so the check has a positive
  // "hydrated" signal to wait on.
  useEffect(() => {
    document.documentElement.dataset['apHydrated'] = 'true'
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
