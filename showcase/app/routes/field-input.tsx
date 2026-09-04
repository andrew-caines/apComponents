import { Button, Field, Icon, Input } from '@ap/react'
import { Page } from '../Page.js'

export default function FieldInput() {
  return (
    <Page slug="field-input">
      <p className="blurb">
        Nothing on this page passes an <code className="mono">id</code>. The label, control, hint and
        error wire their own <code className="mono">for</code>, <code className="mono">id</code> and{' '}
        <code className="mono">aria-describedby</code> through context.
      </p>

      <h2>The common case</h2>
      <div className="stack">
        <Field label="Email" hint="We never share this.">
          <Input name="email" type="email" placeholder="you@example.com" />
        </Field>
      </div>

      <h2>Errors</h2>
      <p className="blurb">
        The icon is not a prop and not optional — an error can never reach a user as colour alone.
      </p>
      <div className="stack">
        <Field label="Email" error="That address is already in use.">
          <Input name="email2" defaultValue="taken@example.com" />
        </Field>
      </div>

      <h2>Sizes</h2>
      <div className="stack">
        {(['sm', 'md', 'lg'] as const).map((size) => (
          <Field key={size} label={`size=${size}`}>
            <Input name={`s-${size}`} size={size} defaultValue="Editable" />
          </Field>
        ))}
      </div>

      <h2>States</h2>
      <div className="stack">
        <Field label="Rest">
          <Input name="a" defaultValue="Editable" />
        </Field>
        <Field label="Disabled">
          <Input name="b" defaultValue="Not editable" disabled />
        </Field>
      </div>

      <h2>Adornments</h2>
      <p className="blurb">
        <code className="mono">startIcon</code> and <code className="mono">endIcon</code>, named for
        the logical edge — in an RTL locale a start icon renders on the right and the name stays
        true. Give one an <code className="mono">onClick</code> and it becomes a real button, at
        which point the type <em>requires</em> a label.
      </p>
      <div className="stack">
        <Field label="Amount" hint="Decorative — clicking the symbol focuses the field.">
          <Input name="amount" defaultValue="1250.00" startIcon={{ icon: <span>€</span> }} />
        </Field>
        <Field label="API key" hint="The clear button is real: tab to it, press Enter.">
          <Input
            name="key"
            defaultValue="sk-live-4f9a2c"
            endIcon={{ icon: <Icon name="close" />, onClick: () => {}, label: 'Clear the API key' }}
          />
        </Field>
        <Field label="Semantic icon colours">
          <Input
            name="q"
            defaultValue="quarterly report"
            startIcon={{ icon: <Icon name="info" />, color: 'info' }}
            endIcon={{ icon: <Icon name="check" />, color: 'success', onClick: () => {}, label: 'Apply' }}
          />
        </Field>
      </div>

      <h2>Loading</h2>
      <p className="blurb">
        Read-only rather than disabled: a disabled field drops out of the tab order <em>and</em> out
        of form submission, so a form posted mid-check would silently lose the value.
      </p>
      <div className="stack">
        <Field label="IBAN" hint="Checked against the bank directory as you type.">
          <Input name="iban" defaultValue="GB33BUKB20201555555555" loading />
        </Field>
      </div>

      <h2>A real form</h2>
      <p className="blurb">
        Uncontrolled, so it submits before hydration. Type into it and press Save — it navigates,
        because it is a real form.
      </p>
      <form method="get" className="stack">
        <Field label="Full name" hint="Appears on the employee record.">
          <Input name="fullName" defaultValue="Ada Lovelace" required />
        </Field>
        <div className="row">
          <Button type="submit">Save</Button>
        </div>
      </form>
    </Page>
  )
}
