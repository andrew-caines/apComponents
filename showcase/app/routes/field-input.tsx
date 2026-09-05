import { Button, Field, Icon, Input } from '@ap/react'
import { Page } from '../Page.js'

export default function FieldInput() {
  return (
    <Page slug="field-input">
      <div className="stack">
        <Field label="Email" hint="We never share this.">
          <Input name="email" type="email" placeholder="you@example.com" />
        </Field>
      </div>

      <div className="stack">
        <Field label="Email" error="That address is already in use.">
          <Input name="email2" defaultValue="taken@example.com" />
        </Field>
      </div>

      <div className="stack">
        {(['sm', 'md', 'lg'] as const).map((size) => (
          <Field key={size} label={`size=${size}`}>
            <Input name={`s-${size}`} size={size} defaultValue="Editable" />
          </Field>
        ))}
      </div>

      <div className="stack">
        <Field label="Rest">
          <Input name="a" defaultValue="Editable" />
        </Field>
        <Field label="Disabled">
          <Input name="b" defaultValue="Not editable" disabled />
        </Field>
      </div>

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

      <div className="stack">
        <Field label="IBAN" hint="Checked against the bank directory as you type.">
          <Input name="iban" defaultValue="GB33BUKB20201555555555" loading />
        </Field>
      </div>

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
