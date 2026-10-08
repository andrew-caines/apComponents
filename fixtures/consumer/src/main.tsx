import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Input, Surface, type SurfaceProps } from '@ap/react'
import { formatDate } from '@ap/react/format'
import { useMediaQuery } from '@ap/react/hooks'
import '@ap/react/fonts.css'
import '@ap/react/theme.css'
import '@ap/react/motion.css'

// Type-level proof that the published types resolve for a consumer. `vite build`
// alone would strip this without checking it, so this fixture also carries its
// own `typecheck` script (tsc --noEmit), run by the CI `consumer` job before
// the build — that's what actually makes this assertion real.
const tone: SurfaceProps['tone'] = 'raised'

// The `./format` and `./hooks` subpaths resolve and typecheck for a consumer,
// and both imports are used, so the build cannot drop them as dead code.
// `@ap/react/format/phone` is left out on purpose: this fixture never installs
// `libphonenumber-js`, and the phone-isolation gate is what proves `./format`
// does not need it.
function WideLayoutNote() {
  const wide = useMediaQuery('(min-width: 48rem)', false)
  return <span data-wide={wide}>{formatDate(0, { locale: 'en-US', timeZone: 'UTC' })}</span>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Surface tone={tone} pad="lg">
      consumer fixture
      <WideLayoutNote />
      {/*
        Loading, specifically. It is the one component state whose whole
        meaning lives in an animation, so it is the state that proves
        `motion.css` survived the trip into a consumer's bundle — a static
        spinner looks fine in a screenshot and says nothing.
      */}
      <Input aria-label="Consumer fixture input" loading />
    </Surface>
  </StrictMode>,
)
