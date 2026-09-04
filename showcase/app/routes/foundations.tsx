import { vars } from '@ap/react'
import { Page, Specimen } from '../Page.js'

const SPACE = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const
const RADIUS = ['sm', 'md', 'lg', 'xl', 'full'] as const
const ICON = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const
const SHADOW = ['1', '2', '3'] as const

export default function Foundations() {
  return (
    <Page slug="foundations">
      <h2>Space</h2>
      <p className="blurb">
        A ratio-derived ramp. Every gap, pad and inset in the library resolves to one of these.
      </p>
      <div className="stack" style={{ maxInlineSize: 'none' }}>
        {SPACE.map((step) => (
          <div key={step} className="row">
            <span className="mono" style={{ inlineSize: '6rem' }}>{`space.${step}`}</span>
            <div
              style={{
                blockSize: 'var(--ap-space-4)',
                inlineSize: vars.space[step],
                background: vars.color.actionBg,
                borderRadius: vars.radius.sm,
              }}
            />
          </div>
        ))}
      </div>

      <h2>Radius</h2>
      <div className="grid">
        {RADIUS.map((r) => (
          <div key={r}>
            <div
              className="swatch"
              style={{ borderRadius: vars.radius[r], background: vars.color.actionBgSubtle }}
            />
            <div className="mono">{`radius.${r}`}</div>
          </div>
        ))}
      </div>

      <h2>Icon sizes</h2>
      <p className="blurb">
        All in <code className="mono">em</code>, so an icon tracks the font size of whatever it sits
        in rather than needing to be re-picked per context.
      </p>
      <Specimen label="icon.xs → icon.2xl">
        {ICON.map((size) => (
          <div key={size} style={{ textAlign: 'center' }}>
            <div
              className="chip"
              style={{ inlineSize: vars.icon[size], blockSize: vars.icon[size] }}
            />
            <div className="mono">{size}</div>
          </div>
        ))}
      </Specimen>

      <h2>Elevation</h2>
      <div className="grid">
        {SHADOW.map((s) => (
          <div key={s}>
            <div
              className="swatch"
              style={{ boxShadow: vars.shadow[s], background: vars.color.bgRaised, border: 0 }}
            />
            <div className="mono">{`shadow.${s}`}</div>
          </div>
        ))}
      </div>
    </Page>
  )
}
