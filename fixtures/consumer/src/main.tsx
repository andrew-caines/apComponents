import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Surface, type SurfaceProps } from '@ap/react'
import '@ap/react/fonts.css'
import '@ap/react/theme.css'

// Type-level proof that the published types resolve for a consumer.
const tone: SurfaceProps['tone'] = 'raised'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Surface tone={tone} pad="lg">
      consumer fixture
    </Surface>
  </StrictMode>,
)
