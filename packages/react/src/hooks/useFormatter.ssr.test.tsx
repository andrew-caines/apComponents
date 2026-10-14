// Deliberately no environment docblock: this runs in the node environment so
// the server pass really has no window.
import { Temporal } from '@js-temporal/polyfill'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LocaleProvider } from '../providers/LocaleProvider.js'
import { useFormatter } from './useFormatter.js'

const V = Date.UTC(2026, 2, 5, 23, 30)

function Probe() {
  const { formatDate, timeZone } = useFormatter()
  return (
    <span>
      {formatDate(V)}|{timeZone}
    </span>
  )
}

describe('useFormatter (server)', () => {
  it('renders dates in UTC when the provider names no zone', () => {
    expect(typeof window).toBe('undefined')
    const html = renderToString(
      <LocaleProvider locale="en-US">
        <Probe />
      </LocaleProvider>,
    )
    expect(html).toContain('Mar 5, 2026')
    expect(html).toContain('UTC')
  })

  it('renders a ZonedDateTime in its own zone on the server', () => {
    function ZonedProbe() {
      const { formatDateTime } = useFormatter()
      return <span>{formatDateTime(Temporal.ZonedDateTime.from('2026-03-05T09:00[Asia/Tokyo]'))}</span>
    }
    const html = renderToString(
      <LocaleProvider locale="en-US">
        <ZonedProbe />
      </LocaleProvider>,
    )
    expect(html).toContain('Mar 5, 2026, 9:00 AM')
  })
})
