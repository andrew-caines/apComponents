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
        submits — the request never reaches `action`. This isn't specific to
        the JS-blocked path: RR8's hydrated `<Form>` intercepts the native
        `submit` event, which the browser only fires after its own
        constraint validation already passed, so the same value would be
        blocked client-side with JS enabled too, before RR8 ever gets a
        chance to fetch-submit it. `noValidate` removes the browser's
        gatekeeping entirely, in both cases, so only the server's validation
        decides.
      */}
      <Form method="post" noValidate>
        <Field
          label="Email"
          hint="We never share this."
          {...(actionData?.error ? { error: actionData.error } : {})}
        >
          {/*
            `id="email-input"` does NOT reach the server-rendered HTML: Base
            UI's Field seeds the control's id from its own internal useId()
            on first render and only reconciles it to this explicit id from a
            post-hydration client effect (see the e2e spec's first test for
            the full trace). This id exists solely for the post-hydration
            test (`#email-input` after `apHydrated` is true) — every
            pre-hydration interaction in this fixture locates the control by
            its label instead, precisely because this id isn't there yet.
          */}
          <Input name="email" type="email" id="email-input" />
        </Field>
        <Button type="submit">Save</Button>
      </Form>
      {actionData?.submitted ? <p id="submitted">received: {actionData.submitted}</p> : null}
    </main>
  )
}
