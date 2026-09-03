import type { ReactNode } from 'react'
import { SECTIONS } from './sections.js'

/**
 * Page chrome for a section. The heading and standfirst come from `SECTIONS`
 * rather than being retyped per route, so a section is described in exactly one
 * place and the nav label always matches the page title.
 */
export function Page({ slug, children }: { slug: string; children: ReactNode }) {
  const section = SECTIONS.find((s) => s.slug === slug)
  return (
    <main>
      <h1>{section?.title ?? slug}</h1>
      {section !== undefined && <p className="blurb">{section.blurb}</p>}
      {children}
    </main>
  )
}

/** A labelled specimen row. The label is what makes a screenshot legible later. */
export function Specimen({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mono">{label}</div>
      <div className="row" style={{ marginBlockStart: 'var(--ap-space-2)' }}>
        {children}
      </div>
    </div>
  )
}
