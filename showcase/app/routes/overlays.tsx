import { Button, Input, Popover, Tooltip } from '@ap/react'
import { Page, Specimen } from '../Page.js'

export default function OverlaysPage() {
  return (
    <Page slug="overlays">
      <Specimen label="tooltip">
        <Tooltip content="Saves the record">
          <Button>Save</Button>
        </Tooltip>
      </Specimen>

      <Specimen label="popover">
        <Popover title="Rename employee" trigger={<Button>Rename</Button>}>
          <Input name="rename" aria-label="New name" />
        </Popover>
      </Specimen>
    </Page>
  )
}
