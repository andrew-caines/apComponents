// The Getting started guide quotes the `start` region of this file verbatim
// (storybook/docs/GettingStarted.mdx). Keep fixture-only notes OUTSIDE it.
// #region docs:start
import { ApProvider, Button, Field, Input } from '@ap/react'

export default function Start() {
  return (
    <ApProvider>
      <main>
        <h1>Join the newsletter</h1>
        <form method="post" action="/subscribe">
          <Field label="Email" hint="We send one email a month.">
            <Input name="email" type="email" required />
          </Field>
          <Button type="submit">Subscribe</Button>
        </form>
      </main>
    </ApProvider>
  )
}
// #endregion docs:start
