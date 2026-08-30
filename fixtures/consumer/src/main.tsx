import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Surface, type SurfaceProps } from '@ap/react'
import '@ap/react/fonts.css'
import '@ap/react/theme.css'

// Type-level proof that the published types resolve for a consumer. `vite build`
// alone would strip this without checking it, so this fixture also carries its
// own `typecheck` script (tsc --noEmit), run by the CI `consumer` job before
// the build — that's what actually makes this assertion real.
const tone: SurfaceProps['tone'] = 'raised'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Surface tone={tone} pad="lg">
      consumer fixture
    </Surface>
  </StrictMode>,
)
