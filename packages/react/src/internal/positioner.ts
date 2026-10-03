'use client'

import { SPACE } from '@ap/tokens'

/**
 * §4.1.7: "A shared default side offset from the space scale" applies to
 * every Base UI positioner (Tooltip, Popover, Select) — only `side` differs
 * per component. Derived from `SPACE['2']` rather than a literal `4`, so the
 * offset can never drift from the token it is documented to come from.
 *
 * This is a **build-time** number: `Number.parseFloat` runs once, here, at
 * module load, against the token's fallback string value. Base UI's
 * `Positioner` takes `sideOffset` as a plain number prop, not a CSS custom
 * property, so a theme that overrides `--ap-space-2` at runtime does not
 * move this offset — it would require re-deriving the constant from the
 * new value and shipping again.
 *
 * The `!` below is `noUncheckedIndexedAccess`, not an unsafe assumption:
 * `SPACE`'s declared type is `Record<string, string>`, so any string index
 * widens to `string | undefined`, but scales.ts's literal object guarantees
 * the `'2'` step exists at runtime.
 */
export const POSITIONER_SIDE_OFFSET: number = Number.parseFloat(SPACE['2']!)
