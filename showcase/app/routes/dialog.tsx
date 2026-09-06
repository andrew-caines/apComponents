import { Button, Dialog, Field, Input, type DialogSize } from '@ap/react'
import { Page, Specimen } from '../Page.js'

const SIZES: DialogSize[] = ['sm', 'md', 'lg', 'xl', 'fit']

export default function DialogPage() {
  return (
    <Page slug="dialog">
      <Specimen label="title, description, body, footer">
        <Dialog
          title="Delete employee"
          description="This removes the record and cannot be undone."
          trigger={<Button tone="danger">Delete…</Button>}
          footer={
            <>
              <Dialog.Close render={<Button variant="ghost">Cancel</Button>} />
              <Button tone="danger">Delete</Button>
            </>
          }
        >
          <Field label="Type the employee id to confirm">
            <Input name="confirm" />
          </Field>
        </Dialog>
      </Specimen>

      <Specimen label="size">
        {SIZES.map((size) => (
          <Dialog
            key={size}
            size={size}
            layout="dialog"
            title={`size = ${size}`}
            trigger={<Button variant="outline">{size}</Button>}
            footer={<Dialog.Close render={<Button>Close</Button>} />}
          >
            <Field label="A labelled field, as a form dialog would have">
              <Input name={`v-${size}`} />
            </Field>
          </Dialog>
        ))}
      </Specimen>

      <Specimen label="header and footer stay put">
        <Dialog
          title="Release notes"
          description="The body scrolls; this header does not."
          trigger={<Button variant="outline">Open a long dialog</Button>}
          footer={<Dialog.Close render={<Button>Done</Button>} />}
        >
          {Array.from({ length: 30 }, (_, i) => (
            <p key={i}>Paragraph {i + 1} — scroll to the end and the footer is still there.</p>
          ))}
        </Dialog>
      </Specimen>

      <Specimen label='layout="auto" (default) vs layout="dialog"'>
        <Dialog title="Adaptive" trigger={<Button variant="outline">auto</Button>}>
          Narrow the window below 640px and reopen me.
        </Dialog>
        <Dialog title="Always centred" layout="dialog" trigger={<Button variant="outline">dialog</Button>}>
          I stay a centred dialog at every width.
        </Dialog>
      </Specimen>
    </Page>
  )
}
