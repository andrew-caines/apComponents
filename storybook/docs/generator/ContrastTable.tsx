import { memo, useMemo } from 'react'
import { contrastPairings, type Theme } from '@ap/tokens'

/** Memoised: the generator re-renders on every keystroke, the theme only once it settles. */
export const ContrastTable = memo(function ContrastTable({ theme }: { theme: Theme }) {
  const rows = useMemo(() => contrastPairings(theme), [theme])
  return (
    <section aria-labelledby="gen-contrast">
      <h2 id="gen-contrast">Contrast</h2>
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
    </section>
  )
})
