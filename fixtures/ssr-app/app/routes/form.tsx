import { Form } from 'react-router'
import { Button, Checkbox, Field, Input, RadioGroup, Switch, Textarea } from '@ap/react'

export async function action({ request }: { request: Request }) {
  const data = await request.formData()
  const email = String(data.get('email') ?? '')
  const message = String(data.get('message') ?? '')
  const subscribe = String(data.get('subscribe') ?? '')
  const notifications = String(data.get('notifications') ?? '')
  const contact = String(data.get('contact') ?? '')
  // Echoed straight back so the test can prove the value reached the server.
  // A deliberate "invalid" case gives the error path something real to render.
  return email.includes('@')
    ? { submitted: email, error: null, message, subscribe, notifications, contact }
    : { submitted: null, error: 'That is not an email address.', message, subscribe, notifications, contact }
}

export default function FormRoute({
  actionData,
}: {
  actionData?: {
    submitted: string | null
    error: string | null
    message: string
    subscribe: string
    notifications: string
    contact: string
  }
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
            its ACCESSIBLE NAME instead, precisely because this id isn't there
            yet. That name is derived from this Field's label during render,
            so it is in the server response.
          */}
          <Input name="email" type="email" id="email-input" />
        </Field>

        {/*
          Textarea has no `label` prop of its own — its accessible name here
          comes from this wrapping Field, and `name` goes on the Textarea
          only, never on the Field too (Field.Root's `name` silently
          overrides the control's own, which reads as working while one
          value is quietly ignored). Textarea renders a real `<textarea>`, so
          it is the one control below that a no-JS user can actually type
          into and have that value post — unlike the three that follow.
        */}
        <Field label="Message" hint="Tell us what you need.">
          <Textarea name="message" defaultValue="Tell us more about your request." />
        </Field>

        {/*
          Checkbox, Switch and RadioGroup each render a `<span role="…">` —
          the operable element, which does nothing without JavaScript — plus
          a sibling hidden `<input>` that is aria-hidden, tabIndex=-1 and
          visually hidden. That hidden input is what carries
          `defaultChecked`/`defaultValue` into a form post, and it does so
          with JavaScript blocked. That is the WHOLE of what this fixture
          proves for these three: their DEFAULT values post without
          JavaScript. It does NOT mean a no-JS visitor can change them — the
          span they would have to operate is inert until hydration.

          Each also has its own `label` prop, so none of them is wrapped in
          a `Field` — Field's job (accessible name from a wrapping label) is
          already done by the component itself.
        */}
        <Checkbox name="subscribe" value="yes" label="Subscribe to updates" defaultChecked />

        <Switch name="notifications" value="on" label="Enable notifications" defaultChecked />

        {/*
          The group as a whole IS named in server HTML — `RadioGroup`
          generates the legend's id itself rather than waiting on Base UI's
          layout-effect registration (see `RadioGroupParts.tsx`). Each
          individual option is a different story: an option's
          `aria-labelledby` is assigned imperatively inside a layout effect,
          so pre-hydration the options themselves are unnamed even though the
          group is.
        */}
        <RadioGroup
          label="Preferred contact method"
          name="contact"
          defaultValue="email"
          options={[
            // "By email", not "Email": the option's own <label> names the
            // hidden radio input inside it, and Playwright's `getByLabel` is a
            // case-insensitive SUBSTRING match that treats any non-hidden
            // <input> as labelable. An option labelled "Email" therefore
            // becomes a second match for a `getByLabel('Email')` aimed at the
            // Field-wrapped email <input> above, and strict mode fails the
            // whole spec. `e2e/progressive-enhancement.spec.ts` no longer
            // locates that field by label at all, but the fixture keeps
            // distinct copy too: two controls in one form sharing a name
            // fragment is a trap for whoever writes the next locator.
            { value: 'email', label: 'By email' },
            { value: 'sms', label: 'By text message' },
          ]}
        />

        <Button type="submit">Save</Button>
      </Form>
      {actionData?.submitted ? <p id="submitted">received: {actionData.submitted}</p> : null}
      {actionData ? (
        <ul id="echo">
          <li id="echo-message">message: {actionData.message}</li>
          <li id="echo-subscribe">subscribe: {actionData.subscribe}</li>
          <li id="echo-notifications">notifications: {actionData.notifications}</li>
          <li id="echo-contact">contact: {actionData.contact}</li>
        </ul>
      ) : null}
    </main>
  )
}
