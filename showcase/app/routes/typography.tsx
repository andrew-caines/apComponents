import { vars } from '@ap/react'
import { Page } from '../Page.js'

const STEPS = ['finePrint', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const

export default function Typography() {
  return (
    <Page slug="typography">
      <h2>The scale</h2>
      <p className="blurb">
        Each step pairs a size with its own line height, so the two can never be mixed up between
        components.
      </p>
      <div className="stack" style={{ maxInlineSize: 'none', gap: 'var(--ap-space-5)' }}>
        {STEPS.map((step) => (
          <div key={step}>
            <div className="mono">{`text.${step}`}</div>
            <div style={{ fontSize: vars.text[step].size, lineHeight: vars.text[step].lineHeight }}>
              The quick brown fox jumps over the lazy dog
            </div>
          </div>
        ))}
      </div>

      <h2>Font stacks</h2>
      <div className="stack" style={{ maxInlineSize: 'none' }}>
        {(['body', 'heading', 'mono'] as const).map((f) => (
          <div key={f}>
            <div className="mono">{`font.${f}`}</div>
            <div style={{ fontFamily: vars.font[f], fontSize: vars.text.lg.size }}>
              Handgloves 0123456789
            </div>
          </div>
        ))}
      </div>

      <h2>Weights</h2>
      <div className="row">
        {(['weightRegular', 'weightMedium', 'weightSemibold'] as const).map((w) => (
          <div key={w}>
            <div style={{ fontWeight: vars.font[w], fontSize: vars.text.lg.size }}>Handgloves</div>
            <div className="mono">{w}</div>
          </div>
        ))}
      </div>

      <h2>The fallback</h2>
      <p className="blurb">
        Inter is self-hosted and paired with a metric-matched local fallback, so the page does not
        reflow when the web font finishes loading. Throttle the network and reload to see how little
        moves.
      </p>
    </Page>
  )
}
