import { Link } from 'react-router'
import { SECTIONS } from '../sections.js'

export default function Home() {
  return (
    <main>
      <h1>ap components</h1>
      <p className="blurb">
        A live view of everything the library ships, one section per feature. Every page renders the
        real components against the real generated theme — nothing here is a mock-up.
      </p>

      <h2>Sections</h2>
      <div className="stack" style={{ maxInlineSize: '40rem' }}>
        {SECTIONS.map((s) => (
          <div key={s.slug}>
            <Link to={`/${s.slug}`}>{s.title}</Link>
            <div className="blurb" style={{ marginBlock: 'var(--ap-space-1) 0' }}>
              {s.blurb}
            </div>
          </div>
        ))}
      </div>

      <h2>Also worth knowing</h2>
      <p className="blurb">
        Three pages under <code className="mono">examples/</code> are generated from the token source
        and committed — the colour reference with every contrast pairing CI asserts, the size scales,
        and an Input/Field reference whose code samples are read out of the source that produced
        them. They are static files: open them from disk. This site is for what needs a running app.
      </p>
    </main>
  )
}
