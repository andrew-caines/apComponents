import { ApProvider, Button, Field, Input } from '@ap/react'

// Reaches Base UI through useId: the first path that found a second React.
export default function FormRoute() {
  return (
    <ApProvider>
      <main id="ext-form">
        <h1>form</h1>
        <form method="post">
          <Field label="Email">
            <Input name="email" type="email" />
          </Field>
          <Button type="submit">Save</Button>
        </form>
      </main>
    </ApProvider>
  )
}
