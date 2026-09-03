import { vars } from '@ap/react'
import { Page } from '../Page.js'

const SURFACES = ['bgCanvas', 'bgSurface', 'bgRaised'] as const
const BORDERS = ['borderSubtle', 'borderNormal', 'borderInteractive'] as const
const TEXT = ['textPrimary', 'textSecondary'] as const
// The four status tones carry a full set (solid, subtle, border, text,
// on-solid). `action` deliberately has no border token — it is an interaction
// colour, not a status, and nothing in the library draws an "action border".
// Listed separately rather than special-cased inside the loop, so the gap is
// visible rather than hidden behind a fallback.
const TONES = ['danger', 'warning', 'success', 'info'] as const

export default function Colour() {
  return (
    <Page slug="colour">
      <p className="blurb">
        Use the scheme switch in the nav to check both. Every foreground/background pairing here is
        asserted for contrast in CI — the full matrix lives in the generated{' '}
        <code className="mono">examples/colours/</code> page.
      </p>

      <h2>Surfaces</h2>
      <div className="grid">
        {SURFACES.map((k) => (
          <div key={k}>
            <div className="swatch" style={{ background: vars.color[k] }} />
            <div className="mono">{k}</div>
          </div>
        ))}
      </div>

      <h2>Borders</h2>
      <div className="grid">
        {BORDERS.map((k) => (
          <div key={k}>
            <div className="swatch" style={{ borderColor: vars.color[k], borderWidth: '2px' }} />
            <div className="mono">{k}</div>
          </div>
        ))}
      </div>

      <h2>Text</h2>
      <div className="stack" style={{ maxInlineSize: 'none' }}>
        {TEXT.map((k) => (
          <div key={k} style={{ color: vars.color[k] }}>
            The quick brown fox <span className="mono">{k}</span>
          </div>
        ))}
      </div>

      <h2>Action</h2>
      <div className="row">
        <div
          style={{
            padding: 'var(--ap-space-2) var(--ap-space-4)',
            borderRadius: vars.radius.sm,
            background: vars.color.actionBg,
            color: vars.color.actionOnSolid,
          }}
        >
          on solid
        </div>
        <div
          style={{
            padding: 'var(--ap-space-2) var(--ap-space-4)',
            borderRadius: vars.radius.sm,
            background: vars.color.actionBgSubtle,
            color: vars.color.actionText,
          }}
        >
          subtle
        </div>
      </div>

      <h2>Status tones</h2>
      <p className="blurb">
        Each tone carries a solid, a subtle background, a border, a text colour and an on-solid
        foreground — so a component never has to pick a shade.
      </p>
      <div className="stack" style={{ maxInlineSize: 'none' }}>
        {TONES.map((tone) => (
          <div key={tone} className="row">
            <span className="mono" style={{ inlineSize: '5rem' }}>{tone}</span>
            <div
              style={{
                padding: 'var(--ap-space-2) var(--ap-space-4)',
                borderRadius: vars.radius.sm,
                background: vars.color[`${tone}Bg`],
                color: vars.color[`${tone}OnSolid`],
              }}
            >
              on solid
            </div>
            <div
              style={{
                padding: 'var(--ap-space-2) var(--ap-space-4)',
                borderRadius: vars.radius.sm,
                background: vars.color[`${tone}BgSubtle`],
                color: vars.color[`${tone}Text`],
                border: `1px solid ${vars.color[`${tone}Border`]}`,
              }}
            >
              subtle
            </div>
          </div>
        ))}
      </div>
    </Page>
  )
}
