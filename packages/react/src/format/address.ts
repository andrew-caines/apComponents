import { guard, type LocaleOptions } from './shared.js'

export interface PostalAddress {
  name?: string | undefined
  organization?: string | undefined
  lines?: readonly string[] | undefined
  locality?: string | undefined
  region?: string | undefined
  postalCode?: string | undefined
  country: string
}

type Field = 'name' | 'organization' | 'locality' | 'region' | 'postalCode'

// A run of fields joined by `sep` (default a space). Empty fields drop out,
// so a separator only appears between two present fields. `prefix` is
// emitted only when the run is not empty.
interface Group {
  fields: Field[]
  sep?: string
  prefix?: string
}

// A template line: the address lines (spread one per line), a single field,
// or groups joined by a space.
type Line = 'lines' | Field | Group[]

const run = (...fields: Field[]): Group[] => [{ fields }]

const WESTERN_HEAD: Line[] = ['name', 'organization', 'lines']

const NO_COMMA_CITY_LAST = [...WESTERN_HEAD, run('locality', 'region', 'postalCode')]
const POSTAL_FIRST = [...WESTERN_HEAD, run('postalCode', 'locality')]
const LOCALITY_POSTAL = [...WESTERN_HEAD, run('locality', 'postalCode')]
const STACKED = [...WESTERN_HEAD, 'locality', 'region', 'postalCode'] as Line[]

const TEMPLATES: Record<string, Line[]> = {
  // City, State ZIP: the comma sits only between locality and region.
  US: [...WESTERN_HEAD, [{ fields: ['locality', 'region'], sep: ', ' }, { fields: ['postalCode'] }]],
  GB: STACKED,
  IE: STACKED,
  AU: NO_COMMA_CITY_LAST,
  NZ: LOCALITY_POSTAL,
  DE: POSTAL_FIRST,
  FR: POSTAL_FIRST,
  NL: POSTAL_FIRST,
  IN: [...WESTERN_HEAD, run('locality', 'postalCode'), 'region'],
  SG: LOCALITY_POSTAL,
  // Japanese order, largest to smallest. Assumes Japanese-script data.
  JP: [
    [{ fields: ['postalCode'], prefix: '〒' }],
    [{ fields: ['region', 'locality'], sep: '' }],
    'lines',
    'organization',
    'name',
  ],
}
TEMPLATES.CA = TEMPLATES.US!
const GENERIC = NO_COMMA_CITY_LAST

function clean(value: string | undefined): string {
  return value?.trim() ?? ''
}

function renderLine(line: Line, address: PostalAddress): string[] {
  if (line === 'lines') return (address.lines ?? []).map(clean).filter(Boolean)
  const groups: Group[] = typeof line === 'string' ? [{ fields: [line] }] : line
  const text = groups
    .map((group) => {
      const joined = group.fields
        .map((field) => clean(address[field]))
        .filter(Boolean)
        .join(group.sep ?? ' ')
      return joined ? (group.prefix ?? '') + joined : ''
    })
    .filter(Boolean)
    .join(' ')
  return text ? [text] : []
}

export function formatAddress(
  address: PostalAddress | null | undefined,
  options: LocaleOptions & { form?: 'multiline' | 'single' | undefined },
): string {
  const bad = typeof address?.country !== 'string' || address.country.trim() === ''
  return guard('formatAddress', address, bad, () => {
    const { locale } = options
    const country = address!.country.trim().toUpperCase()
    const lines = (TEMPLATES[country] ?? GENERIC).flatMap((line) => renderLine(line, address!))
    // Name the country only when the reader is elsewhere. A bare language
    // ('en') has no region, so read it from the maximised locale.
    if (new Intl.Locale(locale).maximize().region !== country) {
      // An unknown code (alpha-3 'USA') makes DisplayNames throw; that drops only
      // the country line, never the whole address.
      try {
        const label = new Intl.DisplayNames(locale, { type: 'region' }).of(country)
        if (label) lines.push(label)
      } catch {
        // no country line
      }
    }
    return lines.join(options.form === 'single' ? ', ' : '\n')
  })
}
