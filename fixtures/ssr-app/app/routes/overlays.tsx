import { Button, Input, LocaleProvider, Popover, Tooltip } from '@ap/react'

/**
 * The surface the Tooltip and Popover hydration checks assert against.
 *
 * This route renders no dismiss control, so it needs no provider: a Popover
 * without one reads no message (see Popover's JSDoc). The `LocaleProvider`
 * copies `dialog.tsx`'s choice, kept so that adding `dismissible` here later
 * needs no other change; it is `LocaleProvider` rather than `ApProvider`
 * because nothing here needs a theme. Tooltip grouping is not part of what
 * this route proves.
 *
 * Routed in both SSR and SPA modes: it exports no loader and no action.
 */
export default function OverlaysRoute() {
  return (
    <LocaleProvider>
      <main>
        <h1>overlays</h1>
        <Tooltip content="Saves the record">
          <Button id="tip-trigger">Save</Button>
        </Tooltip>
        <Popover title="Rename employee" trigger={<Button id="pop-trigger">Rename</Button>}>
          <Input name="rename" id="rename-input" aria-label="New name" />
        </Popover>
      </main>
    </LocaleProvider>
  )
}
