import { useState } from 'react'
import { normalizeHex } from '@ap/tokens'
import { Field, Input } from '@ap/react'
import { isValidHex } from './logic.js'

/**
 * The colour picker and the hex field, kept in step. `onChange` only ever
 * receives a valid hex: an invalid draft shows the field error and goes no
 * further, so the last valid theme stays rendered.
 */
export function SeedInput({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [draft, setDraft] = useState(value)
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    // The picker moved the value; follow it, unless the user is mid-edit on an
    // invalid draft, or the draft already names the same colour (`#abc`, typed
    // on the way to `#abcdef`, must not be rewritten to `#aabbcc` mid-typing).
    if (isValidHex(draft) && normalizeHex(draft) !== normalizeHex(value)) setDraft(value)
  }
  const invalid = !isValidHex(draft)
  return (
    <div className="gen-seed">
      <label className="gen-picker">
        <span>Brand colour (picker)</span>
        {/* The picker only takes #rrggbb, so `#abc` from the hex field is expanded. */}
        <input type="color" value={normalizeHex(value)} onChange={(e) => onChange(e.target.value)} />
      </label>
      <Field label="Brand colour (hex)" {...(invalid ? { error: 'Use #rgb or #rrggbb' } : {})}>
        <Input
          value={draft}
          spellCheck={false}
          onChange={(e) => {
            setDraft(e.target.value)
            if (isValidHex(e.target.value)) onChange(e.target.value.trim())
          }}
        />
      </Field>
    </div>
  )
}
