import { Surface } from '@ap/react'
import { Page } from '../Page.js'

const TONES = ['canvas', 'surface', 'raised'] as const
const PADS = ['none', 'sm', 'md', 'lg'] as const

export default function SurfacePage() {
  return (
    <Page slug="surface">
      <div className="grid">
        {TONES.map((tone) => (
          <Surface key={tone} tone={tone} pad="md">
            <span className="mono">tone={tone}</span>
          </Surface>
        ))}
      </div>

      <div className="grid">
        {PADS.map((pad) => (
          <Surface key={pad} tone="raised" pad={pad}>
            <span className="mono">pad={pad}</span>
          </Surface>
        ))}
      </div>

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
