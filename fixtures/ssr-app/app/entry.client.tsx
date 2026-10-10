import { startTransition, StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { HydratedRouter } from 'react-router/dom'

// React 19 reports a hydration mismatch it recovered from through
// onRecoverableError, not necessarily through the console (5g found this).
// Recording it on window gives hydration.spec.ts something it can assert
// is empty, rather than inferring a clean hydration from console silence.
declare global {
  interface Window {
    __apRecoverableErrors: string[]
  }
}
window.__apRecoverableErrors = []

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
    {
      onRecoverableError(error) {
        window.__apRecoverableErrors.push(String((error as Error)?.message ?? error))
        console.error(error)
      },
    },
  )
})
