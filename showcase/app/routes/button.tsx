import { Button } from '@ap/react'
import { Page, Specimen } from '../Page.js'

const VARIANTS = ['solid', 'outline', 'ghost'] as const
const SIZES = ['sm', 'md', 'lg'] as const

export default function ButtonPage() {
  return (
    <Page slug="button">
      <Specimen label="variant">
        {VARIANTS.map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
      </Specimen>

      {(['action', 'danger'] as const).map((tone) => (
        <Specimen key={tone} label={`tone=${tone}`}>
          {VARIANTS.map((variant) => (
            <Button key={variant} tone={tone} variant={variant}>
              {variant}
            </Button>
          ))}
        </Specimen>
      ))}

      <Specimen label="size">
        {SIZES.map((size) => (
          <Button key={size} size={size}>
            size={size}
          </Button>
        ))}
      </Specimen>

      <Specimen label="disabled, and focus — tab through these">
        <Button>Rest</Button>
        <Button disabled>Disabled</Button>
      </Specimen>

      <Specimen label='render={<a href="…">}'>
        <Button render={<a href="#top">A real anchor</a>} />
      </Specimen>
    </Page>
  )
}
