import { useMemo, useState } from 'react'
import * as iconSet from '@ap/icons'
import { isIconDefinition, type IconDefinition } from '@ap/icons'
import { Icon } from '@ap/icons/react'
import { Input, Switch } from '@ap/react'
// Internal to @ap/icons (not a package export): the docs read it to flag icons
// that are still Lucide ports awaiting the icons-pilot redraw.
import { PENDING_REDRAW } from '../../../packages/icons/src/catalogue.js'
import './icon-gallery.css'

/** Every icon in the set, as [export name, definition], sorted by icon name. */
export const ICONS: ReadonlyArray<readonly [string, IconDefinition]> = Object.entries(iconSet)
  .filter((entry): entry is [string, IconDefinition] => isIconDefinition(entry[1]))
  .sort(([, a], [, b]) => a.name.localeCompare(b.name))

export const SIZES = [16, 20, 24, 32, 48] as const
type Size = (typeof SIZES)[number]

/** Colour presets. `undefined` = inherit the surrounding text colour (currentColor). */
export const COLOURS = [
  { id: 'default', label: 'Text', value: undefined },
  { id: 'action', label: 'Action', value: 'var(--ap-color-action-text)' },
  { id: 'info', label: 'Info', value: 'var(--ap-color-info-text)' },
  { id: 'success', label: 'Success', value: 'var(--ap-color-success-text)' },
  { id: 'warning', label: 'Warning', value: 'var(--ap-color-warning-text)' },
  { id: 'danger', label: 'Danger', value: 'var(--ap-color-danger-text)' },
] as const
type ColourId = (typeof COLOURS)[number]['id']

export interface IconGalleryProps {
  /** Start with duotone on. */
  initialDuoTone?: boolean
  initialSize?: Size
}

export function IconGallery({ initialDuoTone = false, initialSize = 32 }: IconGalleryProps) {
  const [query, setQuery] = useState('')
  const [duoTone, setDuoTone] = useState(initialDuoTone)
  const [size, setSize] = useState<Size>(initialSize)
  const [colourId, setColourId] = useState<ColourId>('default')
  const [copied, setCopied] = useState<string | null>(null)

  const colour = COLOURS.find((c) => c.id === colourId)?.value
  const q = query.trim().toLowerCase()
  const shown = useMemo(
    () => ICONS.filter(([exportName, def]) => !q || def.name.includes(q) || exportName.toLowerCase().includes(q)),
    [q],
  )
  const pending = ICONS.filter(([, def]) => PENDING_REDRAW.includes(def.name)).length

  async function copy(exportName: string) {
    const text = `import { ${exportName} } from '@ap/icons'`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(exportName)
    } catch {
      // Clipboard can be unavailable (insecure context, test runner); the import
      // line is also shown on the card, so nothing is lost.
    }
  }

  return (
    // sb-unstyled opts out of Storybook's docs-page typography (list indents,
    // li margins, paragraph sizes), which otherwise bleeds into the grid.
    <div className="ig sb-unstyled">
      <div className="ig-toolbar">
        <div className="ig-search">
          <Input
            aria-label="Filter icons"
            placeholder="Filter by name…"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
        </div>
        <Switch label="Duotone" checked={duoTone} onCheckedChange={setDuoTone} />
        <div className="ig-segment" role="group" aria-label="Icon size">
          {SIZES.map((s) => (
            <button key={s} type="button" aria-pressed={size === s} onClick={() => setSize(s)}>
              {s}px
            </button>
          ))}
        </div>
        <div className="ig-segment" role="group" aria-label="Icon colour">
          {COLOURS.map((c) => (
            <button key={c.id} type="button" aria-pressed={colourId === c.id} onClick={() => setColourId(c.id)}>
              <span className="ig-dot" style={{ background: c.value ?? 'var(--ap-color-text-primary)' }} />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <p className="ig-summary" data-testid="icon-summary">
        {shown.length === ICONS.length ? `${ICONS.length} icons` : `${shown.length} of ${ICONS.length} icons`}
        {pending > 0 && ` · ${pending} awaiting redraw`}
      </p>

      {shown.length === 0 ? (
        <p className="ig-empty">No icon matches “{query}”.</p>
      ) : (
        <ul className="ig-grid" aria-label="Icons">
          {shown.map(([exportName, def]) => (
            <li key={def.name} className="ig-card" data-icon={def.name}>
              <div className="ig-glyph">
                <Icon
                  icon={def}
                  size={size}
                  duoTone={duoTone}
                  {...(colour !== undefined ? { color: colour } : {})}
                />
              </div>
              <div className="ig-name">{def.name}</div>
              <div className="ig-meta">
                <span className="ig-badge">{def.secondary === 'halo' ? 'halo' : 'filled'}</span>
                {PENDING_REDRAW.includes(def.name) && <span className="ig-badge ig-badge-pending">Lucide port</span>}
              </div>
              <button
                type="button"
                className="ig-copy"
                aria-label={`Copy import for ${exportName}`}
                onClick={() => void copy(exportName)}
              >
                {copied === exportName ? 'Copied' : exportName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
