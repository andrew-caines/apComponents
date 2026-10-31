import { ApProvider, Button, Dialog, Field, Input } from '@ap/react'

// Reaches a Base UI store, through use-sync-external-store.
export default function DialogRoute() {
  return (
    <ApProvider>
      <main id="ext-dialog">
        <h1>dialog</h1>
        <Dialog title="Delete employee" trigger={<Button id="open-dialog">Delete…</Button>}>
          <Field label="Employee id">
            <Input name="confirm" />
          </Field>
        </Dialog>
      </main>
    </ApProvider>
  )
}
