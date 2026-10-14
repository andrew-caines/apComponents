// The Getting started guide quotes the `dates` region of this file verbatim
// (storybook/docs/GettingStarted.mdx). Keep fixture-only notes OUTSIDE it.
// The ids are for e2e/dates.spec.ts.
// #region docs:dates
import { Temporal } from '@js-temporal/polyfill'
import { ApProvider } from '@ap/react'
import { useFormatter } from '@ap/react/hooks'

const hireDate = Temporal.PlainDate.from('1990-05-12')
const meeting = Temporal.ZonedDateTime.from('2026-03-05T09:00[Asia/Tokyo]')
const published = Temporal.Instant.from('2026-03-05T00:00:00Z')

function Dates() {
  const { formatDate, formatDateTime, isoFor } = useFormatter()
  return (
    <dl>
      <dt>Hired</dt>
      <dd>
        <time id="plain-date" dateTime={isoFor(hireDate)}>{formatDate(hireDate)}</time>
      </dd>
      <dt>Meeting (Tokyo time)</dt>
      <dd>
        <time id="zoned" dateTime={isoFor(meeting)}>{formatDateTime(meeting)}</time>
      </dd>
      <dt>Published (your time)</dt>
      <dd>
        <time id="instant" dateTime={isoFor(published)}>{formatDateTime(published)}</time>
      </dd>
    </dl>
  )
}

export default function DatesRoute() {
  return (
    <ApProvider locale="en-US">
      <main>
        <h1>Dates</h1>
        <Dates />
      </main>
    </ApProvider>
  )
}
// #endregion docs:dates
