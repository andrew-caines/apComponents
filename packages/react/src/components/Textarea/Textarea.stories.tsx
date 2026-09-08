import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Field } from '../Field/Field.js'
import { Textarea } from './Textarea.js'

const meta = {
  title: 'Components/Textarea',
  component: Textarea,
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    resize: { control: 'inline-radio', options: ['none', 'vertical'] },
    disabled: { control: 'boolean' },
  },
  // `Textarea` has no `label` prop — this is its accessible name for every
  // story that does not supply its own via a wrapping `Field`.
  args: { 'aria-label': 'Notes', placeholder: 'Add any additional context…' },
} satisfies Meta<typeof Textarea>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '0.5rem', maxWidth: 320 }}>
      <Textarea aria-label="Notes (sm)" size="sm" placeholder="sm" />
      <Textarea aria-label="Notes (md)" size="md" placeholder="md" />
      <Textarea aria-label="Notes (lg)" size="lg" placeholder="lg" />
    </div>
  ),
}

export const Disabled: Story = { args: { disabled: true } }

export const WithinField: Story = {
  render: () => (
    <Field label="Additional notes" hint="Visible to your care team only.">
      <Textarea />
    </Field>
  ),
}

export const Invalid: Story = {
  render: () => (
    <Field label="Additional notes" error="Notes cannot be empty.">
      <Textarea />
    </Field>
  ),
  play: async ({ canvasElement }) => {
    const textarea = within(canvasElement).getByRole('textbox', { name: 'Additional notes' })
    await expect(textarea).toHaveAttribute('aria-invalid', 'true')
  },
}

/**
 * Renders inside a real `<form>` so the play function can prove a negative:
 * Base UI gates its Enter-to-commit path on `tagName === 'INPUT'`
 * (`field/control/FieldControl.js:138`), so Enter in a real `<textarea>`
 * inserts a newline and never reaches that path at all. The marker only
 * appears if `onSubmit` fires, which is the observable proof the form did not
 * submit.
 */
function EnterStaysInFieldDemo() {
  const [submitted, setSubmitted] = useState(false)
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        setSubmitted(true)
      }}
    >
      <Field label="Notes">
        <Textarea name="notes" />
      </Field>
      {submitted ? <p>Form submitted</p> : null}
    </form>
  )
}

export const EnterInsertsNewlineWithoutSubmitting: Story = {
  render: () => <EnterStaysInFieldDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const textarea = canvas.getByRole('textbox', { name: 'Notes' })
    await userEvent.click(textarea)
    await userEvent.keyboard('line one{Enter}line two')
    await expect(textarea).toHaveValue('line one\nline two')
    // No marker: the newline never became a form submission.
    await expect(canvas.queryByText('Form submitted')).toBeNull()
  },
}
