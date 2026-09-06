import { Spinner } from '@ap/react'
import { Page, Specimen } from '../Page.js'

const SIZES = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const

export default function SpinnerPage() {
  return (
    <Page slug="spinner">
      <Specimen label="size=xs … 2xl">
        {SIZES.map((size) => (
          <div key={size} style={{ textAlign: 'center' }}>
            <Spinner size={size} />
            <div className="mono">{size}</div>
          </div>
        ))}
      </Specimen>

      <Specimen label="currentColor">
        {(['textPrimary', 'textSecondary', 'actionText', 'dangerText'] as const).map((c) => (
          <div key={c} style={{ color: `var(--ap-color-${c.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)})` }}>
            <Spinner size="lg" />
          </div>
        ))}
      </Specimen>

      <Specimen label="watch this one with reduce-motion on">
        <Spinner size="2xl" />
      </Specimen>
    </Page>
  )
}
