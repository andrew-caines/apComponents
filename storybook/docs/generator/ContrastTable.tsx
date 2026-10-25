import { memo, useMemo } from 'react'
import { contrastPairings, type ContrastPairing, type Theme } from '@ap/tokens'

function PairingTable({ rows }: { rows: ContrastPairing[] }) {
  return (
    <div className="gen-scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">Mode</th>
            <th scope="col">Text</th>
            <th scope="col">On</th>
            <th scope="col">WCAG</th>
            <th scope="col">Needs</th>
            <th scope="col">APCA Lc</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={`${p.mode}-${p.fg}-${p.bg}`} data-pass={p.pass}>
              <td>{p.mode}</td>
              <td className="mono">{p.fg}</td>
              <td className="mono">{p.bg}</td>
              <td>{p.ratio.toFixed(2)}:1</td>
              <td>{p.required}:1</td>
              <td>{p.apca.toFixed(1)}</td>
              <td>{p.pass ? 'Pass' : 'Fail'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Memoised: the generator re-renders on every keystroke, the theme only once it settles.
 * The full table runs to 110 rows, so it starts collapsed: the summary and any
 * failing pairings are what a visitor needs first.
 */
export const ContrastTable = memo(function ContrastTable({ theme }: { theme: Theme }) {
  const rows = useMemo(() => contrastPairings(theme), [theme])
  const failing = rows.filter((p) => !p.pass)
  return (
    <section aria-labelledby="gen-contrast">
      <h2 id="gen-contrast">Contrast</h2>
      <p data-testid="contrast-summary">
        {rows.length} pairings, {failing.length ? `${failing.length} fail` : 'all pass'}.
      </p>
      {failing.length > 0 && <PairingTable rows={failing} />}
      <details>
        <summary>All {rows.length} pairings</summary>
        <PairingTable rows={rows} />
      </details>
    </section>
  )
})
