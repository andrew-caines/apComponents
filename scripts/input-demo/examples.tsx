// Source of truth for examples/InputFields.html.
//
// Each entry's `render` body is BOTH executed (to produce the live output on
// the page) and read back out of this file's TypeScript AST (to produce the
// code block printed beside it). There is no second copy of the snippet
// anywhere, so the code the page shows is, by construction, the code that
// produced the markup next to it — a documentation page cannot drift from
// what it documents if it only ever holds one version of it.
//
// Keep each `render` body small and idiomatic: it is public-facing sample
// code, not a test fixture.
import type { ReactElement } from 'react'
import { Button, Field, Icon, Input } from '../../packages/react/src/index.js'

export interface Example {
  /** Anchor id and the key the generator matches AST source against. */
  id: string
  title: string
  /** One or two sentences. Rendered above the specimen, below the title. */
  note: string
  render: () => ReactElement
}

export const EXAMPLES: Example[] = [
  {
    id: 'basic',
    title: 'A labelled field',
    note:
      'The common case. `label` is required, because an unlabelled field is a defect rather than a ' +
      'style choice. Nothing here passes an `id`: the label, the control and the hint wire their own ' +
      '`for`, `id` and `aria-describedby` through context.',
    render: () => (
      <Field label="Email" hint="We never share this.">
        <Input name="email" type="email" placeholder="you@example.com" />
      </Field>
    ),
  },
  {
    id: 'error',
    title: 'An error from the server',
    note:
      'Passing `error` marks the field invalid and shows the message. The icon is not optional and ' +
      'not a prop — it is part of what `Field.Error` renders, so an error can never reach a user as ' +
      'colour alone (WCAG 1.4.1).',
    render: () => (
      <Field label="Email" hint="We never share this." error="That address is already in use.">
        <Input name="email" type="email" defaultValue="taken@example.com" />
      </Field>
    ),
  },
  {
    id: 'sizes',
    title: 'Sizes',
    note:
      '`size` is a recipe variant — `sm`, `md`, `lg` — not the legacy HTML width-in-characters ' +
      'attribute, which it deliberately displaces. Padding and type step together.',
    render: () => (
      <>
        <Field label="Small">
          <Input name="s" size="sm" defaultValue="size=sm" />
        </Field>
        <Field label="Medium (default)">
          <Input name="m" defaultValue="size=md" />
        </Field>
        <Field label="Large">
          <Input name="l" size="lg" defaultValue="size=lg" />
        </Field>
      </>
    ),
  },
  {
    id: 'states',
    title: 'States',
    note:
      'Rest, disabled and invalid. Hover and focus are not pinned specimens here — every input on ' +
      'this page is a real one, so hover and tab through them to see those states directly.',
    render: () => (
      <>
        <Field label="Rest">
          <Input name="a" defaultValue="Editable" />
        </Field>
        <Field label="Disabled">
          <Input name="b" defaultValue="Not editable" disabled />
        </Field>
        <Field label="Invalid" error="Something is wrong with this value.">
          <Input name="c" defaultValue="Rejected" />
        </Field>
      </>
    ),
  },
  {
    id: 'types',
    title: 'Native input types',
    note:
      'Uncontrolled and native by default, so every `<input>` type works as it always did, along ' +
      'with the browser’s own validation and autofill.',
    render: () => (
      <>
        <Field label="Password">
          <Input name="pw" type="password" defaultValue="hunter2" />
        </Field>
        <Field label="Number">
          <Input name="qty" type="number" defaultValue="3" min={0} max={10} />
        </Field>
        <Field label="Search">
          <Input name="q" type="search" placeholder="Search employees" />
        </Field>
      </>
    ),
  },
  {
    id: 'adornments',
    note:
      'An icon inside the control, at the inline start or end. `start` and `end` rather than left ' +
      'and right, because the position is set with `inset-inline-*` — in an RTL locale a ' +
      '`startIcon` renders on the right and the name stays true. Give the adornment an `onClick` ' +
      'and it becomes a real `<button type="button">`; the type then requires a `label`, because a ' +
      'button with no accessible name is unusable by anyone not looking at it. Without `onClick` ' +
      'the icon is decorative and transparent to clicks, so tapping the currency symbol puts the ' +
      'caret in the field behind it. `color` takes a semantic role — every option is a foreground ' +
      'token the contrast gate covers, so none of them is unreadable. The hit area is the full ' +
      'height of the control; only the smaller chip inside it is painted, so a hover background ' +
      'never runs into the border.',
    title: 'Icons inside the field',
    render: () => (
      <>
        <Field label="Amount" hint="Decorative — clicking the symbol focuses the field.">
          <Input name="amount" defaultValue="1250.00" startIcon={{ icon: <span>€</span> }} />
        </Field>
        <Field label="API key" hint="The clear button is a real button: tab to it, press Enter.">
          <Input
            name="key"
            defaultValue="sk-live-4f9a2c"
            endIcon={{
              icon: <Icon name="close" />,
              onClick: () => {},
              label: 'Clear the API key',
            }}
          />
        </Field>
        <Field label="Both ends, with semantic colours">
          <Input
            name="search"
            defaultValue="quarterly report"
            startIcon={{ icon: <Icon name="info" />, color: 'info' }}
            endIcon={{
              icon: <Icon name="check" />,
              color: 'success',
              onClick: () => {},
              label: 'Apply filter',
            }}
          />
        </Field>
      </>
    ),
  },
  {
    id: 'compound',
    title: 'The compound API, when layout needs controlling',
    note:
      'The same parts the convenience component is built from. Reach for these when the order or ' +
      'the markup between them has to change. `Field.Root invalid` is the one route to an invalid ' +
      'state without a message — and it makes you render your own `Field.Error`, which is why the ' +
      'convenience component does not expose `invalid` at all.',
    render: () => (
      <Field.Root>
        <Field.Label>Employee ID</Field.Label>
        <Field.Description>Six digits, no prefix.</Field.Description>
        <Input name="employee-id" defaultValue="004512" />
        <Field.Error match>Not a known employee.</Field.Error>
      </Field.Root>
    ),
  },
  {
    id: 'uncontrolled',
    title: 'Uncontrolled, so it submits before hydration',
    note:
      'The value lives in the DOM, not in React state. That is what lets a real form post run its ' +
      'server action before any JavaScript has loaded — the claim `test:hydration` proves in a ' +
      'browser with every client bundle blocked. Type into this one and submit it: it navigates, ' +
      'because it is a real form.',
    render: () => (
      <form method="get">
        <Field label="Full name" hint="Appears on the employee record.">
          <Input name="fullName" defaultValue="Ada Lovelace" required />
        </Field>
        <Button type="submit">Save</Button>
      </form>
    ),
  },
  {
    id: 'standalone',
    title: 'An input on its own',
    note:
      '`Input` works outside a `Field`. It then carries no label for you, so give it one — an ' +
      '`aria-label` here, or a `<label for>` you write yourself.',
    render: () => <Input name="filter" aria-label="Filter" placeholder="Filter results" />,
  },
]
