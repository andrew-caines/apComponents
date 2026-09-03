import { Form } from 'react-router'
import { Button, Field, Input } from '@ap/react'

export async function action({ request }: { request: Request }) {
  const data = await request.formData()
  const email = String(data.get('email') ?? '')
  // Echoed straight back so the test can prove the value reached the server.
  // A deliberate "invalid" case gives the error path something real to render.
  return email.includes('@')
    ? { submitted: email, error: null }
    : { submitted: null, error: 'That is not an email address.' }
}

export default function FormRoute({
  actionData,
}: {
  actionData?: { submitted: string | null; error: string | null }
}) {
  return (
    <main>
      <h1>form</h1>
      {/*
        noValidate: this route exists to prove the SERVER action's own
        validation (ADR-0011 §4/§5), not the browser's. Without it, the
        browser's native `type="email"` constraint intercepts an
        obviously-malformed value (no "@" at all) before the form ever
        submits — the request never reaches `action`, so the server-side
        error path this route exists to exercise would be unreachable by a
        real click, only by JS-driven `requestSubmit()` bypassing validation.
      */}
      <Form method="post" noValidate>
        <Field
          label="Email"
          hint="We never share this."
          {...(actionData?.error ? { error: actionData.error } : {})}
        >
          <Input name="email" type="email" id="email-input" />
        </Field>
        <Button type="submit">Save</Button>
      </Form>
      {actionData?.submitted ? <p id="submitted">received: {actionData.submitted}</p> : null}
    </main>
  )
}
