import { Surface } from '@ap/react'
import { Page } from '../Page.js'

const TONES = ['canvas', 'surface', 'raised'] as const
const PADS = ['none', 'sm', 'md', 'lg'] as const

export default function SurfacePage() {
  return (
    <Page slug="surface">
      <h2>Tones</h2>
      <p className="blurb">
        Three background steps, meant to be nested: canvas behind surface behind raised. Switch
        schemes in the nav — in dark mode the order inverts in lightness but keeps its meaning.
      </p>
      <div className="grid">
        {TONES.map((tone) => (
          <Surface key={tone} tone={tone} pad="md">
            <span className="mono">tone={tone}</span>
          </Surface>
        ))}
      </div>

      <h2>Padding</h2>
      <div className="grid">
        {PADS.map((pad) => (
          <Surface key={pad} tone="raised" pad={pad}>
            <span className="mono">pad={pad}</span>
          </Surface>
        ))}
      </div>

      <h2>Nested</h2>
      <Surface tone="canvas" pad="lg">
        <Surface tone="surface" pad="lg">
          <Surface tone="raised" pad="md">
            <span className="mono">raised inside surface inside canvas</span>
          </Surface>
        </Surface>
      </Surface>
    </Page>
  )
}
