import { Button, Dialog, Field, Input, LocaleProvider } from '@ap/react'

/**
 * The surface Phase 4d's browser checks assert against.
 *
 * `LocaleProvider` rather than `ApProvider`: Dialog needs the message registry
 * for its dismiss control's accessible name and nothing else here needs a
 * theme, and wrapping the whole fixture in `ApProvider` would put a
 * `<html>`-attribute write into every existing hydration assertion's path for
 * no reason connected to this route.
 *
 * The body deliberately contains a `Field` + `Input`. A form is the most common
 * dialog content and the one that breaks shrink-to-fit sizing, so the checks
 * get a realistic subject rather than a paragraph of text.
 */
export default function DialogRoute() {
  return (
    <LocaleProvider>
      <main>
        <h1>dialog</h1>
        <p id="before">Content behind the dialog.</p>
        <Dialog
          title="Delete employee"
          description="This removes the record and cannot be undone."
          trigger={<Button id="open-dialog">Delete…</Button>}
          footer={
            <>
              <Dialog.Close render={<Button id="cancel">Cancel</Button>} />
              <Button id="confirm">Delete</Button>
            </>
          }
        >
          <Field label="Type the employee id to confirm">
            <Input name="confirm" id="confirm-input" />
          </Field>
        </Dialog>

        {/*
          One dialog per width step, plus `fit`. These exist so the sizing
          claims can be read off `getComputedStyle` in a real browser rather
          than inferred from a class name — in particular that a `fit` dialog
          wrapping a Field and an Input does not collapse to the width of its
          longest label, which is the failure the min-inline-size floor exists
          to prevent and the reason `fit` is not the default.
        */}
        {(['sm', 'md', 'lg', 'xl', 'fit'] as const).map((size) => (
          <Dialog
            key={size}
            size={size}
            layout="dialog"
            title={`Size ${size}`}
            trigger={<Button id={`open-${size}`}>{`open ${size}`}</Button>}
          >
            <Field label="An ordinary labelled field, as a form dialog would have">
              <Input name={`v-${size}`} />
            </Field>
          </Dialog>
        ))}
      </main>
    </LocaleProvider>
  )
}
