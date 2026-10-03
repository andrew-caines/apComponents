import { Button, Input, LocaleProvider, Popover, Tooltip } from '@ap/react'

/**
 * The surface the Tooltip and Popover hydration checks assert against.
 *
 * `LocaleProvider` rather than `ApProvider`, for the reason `dialog.tsx` gives:
 * Popover needs the message registry for its dismiss control and nothing here
 * needs a theme. Tooltip grouping is not part of what this route proves.
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
