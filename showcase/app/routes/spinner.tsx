import { Spinner } from '@ap/react'
import { Page, Specimen } from '../Page.js'

const SIZES = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const

export default function SpinnerPage() {
  return (
    <Page slug="spinner">
      <h2>Sizes</h2>
      <p className="blurb">
        Same contract as Icon: <code className="mono">em</code>-based sizes and{' '}
        <code className="mono">currentColor</code>, so it takes the size and colour of whatever it
        sits in.
      </p>
      <Specimen label="size=xs … 2xl">
        {SIZES.map((size) => (
          <div key={size} style={{ textAlign: 'center' }}>
            <Spinner size={size} />
            <div className="mono">{size}</div>
          </div>
        ))}
      </Specimen>

      <h2>Inherited colour</h2>
      <Specimen label="currentColor">
        {(['textPrimary', 'textSecondary', 'actionText', 'dangerText'] as const).map((c) => (
          <div key={c} style={{ color: `var(--ap-color-${c.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)})` }}>
            <Spinner size="lg" />
          </div>
        ))}
      </Specimen>

      <h2>Reduced motion</h2>
      <p className="blurb">
        A spinner is the one motion where the movement <em>is</em> the information, so it does not
        degrade to nothing. Turn on “reduce motion” in your OS and reload: the rotation goes away and
        a slow opacity breath remains, which still says “working”. Nothing in the component changes —
        the swap happens at the token layer.
      </p>
      <Specimen label="watch this one with reduce-motion on">
        <Spinner size="2xl" />
      </Specimen>

      <h2>The arc is open on purpose</h2>
      <p className="blurb">
        A complete ring rotating is indistinguishable from a static one, which is the classic way a
        spinner ends up conveying nothing at all.
      </p>
    </Page>
  )
}
