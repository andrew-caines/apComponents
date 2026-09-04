import { Icon, ICON_PATHS, type IconName } from '@ap/react'
import { Page, Specimen } from '../Page.js'

const NAMES = Object.keys(ICON_PATHS) as IconName[]
const SIZES = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const

export default function Icons() {
  return (
    <Page slug="icons">
      <p className="blurb">
        Three icons today. The set is deliberately small — the rest arrive with the components that
        need them, so nothing ships unused.
      </p>

      <h2>The set</h2>
      <div className="grid">
        {NAMES.map((name) => (
          <div key={name} className="row">
            <Icon name={name} size="lg" />
            <span className="mono">{name}</span>
          </div>
        ))}
      </div>

      <h2>Sizes</h2>
      <p className="blurb">
        Sizes are <code className="mono">em</code>-based, so an icon inherits the type size of its
        context. Colour comes from <code className="mono">currentColor</code> — there is no colour
        prop to keep in sync.
      </p>
      <Specimen label="size=xs … 2xl">
        {SIZES.map((size) => (
          <div key={size} style={{ textAlign: 'center' }}>
            <Icon name="info" size={size} />
            <div className="mono">{size}</div>
          </div>
        ))}
      </Specimen>

      <h2>Decorative or labelled, never both</h2>
      <p className="blurb">
        Without a <code className="mono">label</code> an icon is hidden from assistive technology,
        which is right whenever text beside it already says the same thing. With one it becomes an
        image with an accessible name. Announcing a state twice is noise, not redundancy.
      </p>
      <div className="stack" style={{ maxInlineSize: 'none' }}>
        <div className="row">
          <Icon name="check" />
          <span>Saved — the icon here is decorative, the word carries the meaning</span>
        </div>
        <div className="row">
          <Icon name="check" label="Saved" />
          <span className="mono">label=&quot;Saved&quot; — announced, because nothing else says it</span>
        </div>
      </div>
    </Page>
  )
}
