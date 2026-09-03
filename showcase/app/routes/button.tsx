import { Button } from '@ap/react'
import { Page, Specimen } from '../Page.js'

const VARIANTS = ['solid', 'outline', 'ghost'] as const
const SIZES = ['sm', 'md', 'lg'] as const

export default function ButtonPage() {
  return (
    <Page slug="button">
      <h2>Variants</h2>
      <Specimen label="variant">
        {VARIANTS.map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
      </Specimen>

      <h2>Tones</h2>
      <p className="blurb">
        Tone and variant are separate axes, so a destructive action can be quiet.
      </p>
      {(['action', 'danger'] as const).map((tone) => (
        <Specimen key={tone} label={`tone=${tone}`}>
          {VARIANTS.map((variant) => (
            <Button key={variant} tone={tone} variant={variant}>
              {variant}
            </Button>
          ))}
        </Specimen>
      ))}

      <h2>Sizes</h2>
      <Specimen label="size">
        {SIZES.map((size) => (
          <Button key={size} size={size}>
            size={size}
          </Button>
        ))}
      </Specimen>

      <h2>States</h2>
      <Specimen label="disabled, and focus — tab through these">
        <Button>Rest</Button>
        <Button disabled>Disabled</Button>
      </Specimen>

      <h2>Rendered as a link</h2>
      <p className="blurb">
        <code className="mono">render</code> swaps the element without losing the styling, so a
        button that navigates is a real anchor — with a real href, a real context menu, and real
        middle-click behaviour.
      </p>
      <Specimen label='render={<a href="…">}'>
        <Button render={<a href="#top">A real anchor</a>} />
      </Specimen>
    </Page>
  )
}
