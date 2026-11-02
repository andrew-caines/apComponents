import { ApProvider, Button, Field, Popover, Select, Tooltip } from '@ap/react'

// Reaches Floating UI's React bindings.
export default function OverlaysRoute() {
  return (
    <ApProvider>
      <main id="ext-overlays">
        <h1>overlays</h1>
        <Tooltip content="Saves the record">
          <Button>Save</Button>
        </Tooltip>
        <Popover title="Rename" trigger={<Button>Rename</Button>}>
          <p>Popover body</p>
        </Popover>
        <Field label="Country">
          <Select
            name="country"
            defaultValue="ca"
            options={[
              { value: 'ca', label: 'Canada' },
              { value: 'fr', label: 'France' },
            ]}
          />
        </Field>
      </main>
    </ApProvider>
  )
}
