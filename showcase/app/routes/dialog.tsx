import { Button, Dialog, Field, Input, type DialogSize } from '@ap/react'
import { Page, Specimen } from '../Page.js'

const SIZES: DialogSize[] = ['sm', 'md', 'lg', 'xl', 'fit']

export default function DialogPage() {
  return (
    <Page slug="dialog">
      <h2>The common case</h2>
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

      <h2>Sizes</h2>
      <p className="blurb">
        <code className="mono">size</code> is a width cap, never a fixed width, so a dialog is fluid
        below its cap and never wider than the viewport. Height is not a prop: it grows to content,
        stops at the viewport, and the body scrolls with the header and footer pinned.
      </p>
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
      <p className="blurb">
        Open <code className="mono">fit</code> and compare it with <code className="mono">sm</code>.
        It shrinks to its content, but it cannot collapse: <code className="mono">fit-content</code>{' '}
        resolves against max-content, and a percentage-width child like an input contributes nothing
        to that — without a floor this dialog would be as wide as its longest label. That is why{' '}
        <code className="mono">md</code> is the default and <code className="mono">fit</code> is for
        alerts.
      </p>

      <h2>Long content scrolls inside</h2>
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

      <h2>Bottom sheet under 640px</h2>
      <p className="blurb">
        <code className="mono">layout=&quot;auto&quot;</code> is the default and presents as a sheet
        below the <code className="mono">sm</code> breakpoint. Narrow the window past 640px and
        reopen — it slides up from the bottom edge instead of fading in centred. The switch is a
        media query, not a JavaScript breakpoint, because structure decided by a JS media query is a
        hydration mismatch by construction.
      </p>
      <Specimen label='layout="auto" (default) vs layout="dialog"'>
        <Dialog title="Adaptive" trigger={<Button variant="outline">auto</Button>}>
          Narrow the window below 640px and reopen me.
        </Dialog>
        <Dialog title="Always centred" layout="dialog" trigger={<Button variant="outline">dialog</Button>}>
          I stay a centred dialog at every width.
        </Dialog>
      </Specimen>

      <h2>Focus and motion</h2>
      <p className="blurb">
        Open any dialog and tab: focus is trapped inside, and Escape returns it to the trigger you
        came from. The entrance uses the shared motion tokens, so with “reduce motion” on the
        movement drops away and only the fade remains — with no change in the component.
      </p>
    </Page>
  )
}
