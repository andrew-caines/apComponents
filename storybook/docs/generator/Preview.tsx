import { memo } from 'react'
import { Button, Checkbox, Field, Input, Select, Switch, Tabs, ThemeProvider } from '@ap/react'
import type { Theme } from '@ap/tokens'

function Panel({ name }: { name: string }) {
  return (
    <div role="group" aria-label={name} className="gen-panel stack">
      <p className="gen-panel-name">{name}</p>
      <div className="row">
        <Button>Primary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button tone="danger">Delete</Button>
      </div>
      <Field label="Name"><Input defaultValue="Ada Lovelace" /></Field>
      <Field label="Email" error="That is not an email address."><Input defaultValue="ada" /></Field>
      <Checkbox label="Subscribe" defaultChecked />
      <Switch label="Notifications" defaultChecked />
      <Field label="Country">
        <Select options={[{ value: 'ca', label: 'Canada' }, { value: 'fr', label: 'France' }]} defaultValue="ca" />
      </Field>
      <Tabs
        aria-label="Sections"
        items={[
          { value: 'a', label: 'Overview', content: <p>Overview</p> },
          { value: 'b', label: 'Details', content: <p>Details</p> },
        ]}
      />
    </div>
  )
}

/**
 * Real components under the generated theme. A scoped `ThemeProvider` writes
 * `data-ap-scheme` on its own element, so a nested `scheme="dark"` resolves
 * the generated dark tokens inside a light page, and the panels sit side by side.
 */
export const Preview = memo(function Preview({ theme }: { theme: Theme }) {
  return (
    <section aria-labelledby="gen-preview" data-testid="preview">
      <h2 id="gen-preview">Preview</h2>
      <div className="gen-two">
        <ThemeProvider theme={theme} scheme="light"><Panel name="Light" /></ThemeProvider>
        <ThemeProvider theme={theme} scheme="dark"><Panel name="Dark" /></ThemeProvider>
      </div>
    </section>
  )
})
