import { Checkbox, Field, RadioGroup, Switch, Textarea } from '@ap/react'
import { Page, Specimen } from '../Page.js'

const SIZES = ['sm', 'md', 'lg'] as const

export default function FormControlsPage() {
  return (
    <Page slug="form-controls">
      <Specimen label="Textarea — size=sm … lg">
        {SIZES.map((size) => (
          <Field key={size} label={`size=${size}`}>
            <Textarea name={`notes-${size}`} size={size} defaultValue="Editable" />
          </Field>
        ))}
      </Specimen>

      <Specimen label="Checkbox — size=sm … lg">
        {SIZES.map((size) => (
          <Checkbox
            key={size}
            name={`agree-${size}`}
            value="yes"
            label={`size=${size}`}
            size={size}
            defaultChecked
          />
        ))}
      </Specimen>

      <Specimen label="Checkbox — indeterminate">
        <Checkbox name="select-all" value="yes" label="Select all" indeterminate />
      </Specimen>

      <Specimen label="Switch — size=sm … lg">
        {SIZES.map((size) => (
          <Switch key={size} name={`notify-${size}`} value="on" label={`size=${size}`} size={size} defaultChecked />
        ))}
      </Specimen>

      <Specimen label="RadioGroup">
        <RadioGroup
          label="Preferred contact method"
          name="contact"
          defaultValue="email"
          options={[
            { value: 'email', label: 'Email' },
            { value: 'sms', label: 'Text message', hint: 'Standard rates apply.' },
            { value: 'none', label: 'Do not contact me' },
          ]}
        />
      </Specimen>
    </Page>
  )
}
