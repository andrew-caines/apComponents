import type { RampName, Theme } from '@ap/tokens'
import { SEMANTIC_MAP } from '@ap/tokens'

const RAMPS: RampName[] = ['brand', 'neutral', 'danger', 'warning', 'success', 'info']

/** A row of decorative colour blocks. Each carries its hex as a `title`. */
export function RampStrip({ hexes, label }: { hexes: string[]; label: string }) {
  return (
    <figure className="stack" style={{ margin: 0 }}>
      <figcaption className="mono">{label}</figcaption>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${hexes.length}, 1fr)` }}>
        {hexes.map((hex, i) => (
          <div key={i} title={hex} style={{ background: hex, blockSize: '2.5rem' }} />
        ))}
      </div>
    </figure>
  )
}

/** Six ramps × twelve steps for one mode, every value read from the theme. */
export function RampTable({ theme, mode }: { theme: Theme; mode: 'light' | 'dark' }) {
  return (
    <div className="stack">
      {RAMPS.map((name) => (
        <RampStrip key={name} label={`${name} (${mode})`} hexes={theme.ramps[mode][name].steps.map((s) => s.hex)} />
      ))}
    </div>
  )
}

/** Which semantic tokens read each step, from SEMANTIC_MAP, not a retyped list. */
export function StepRoles() {
  const byStep = new Map<string, string[]>()
  for (const e of SEMANTIC_MAP) {
    const key = String(e.step)
    byStep.set(key, [...(byStep.get(key) ?? []), `${e.token} (${e.ramp})`])
  }
  const rank = (k: string): number => (k === 'onSolid' ? Infinity : Number(k))
  const rows = [...byStep.entries()].sort((a, b) => rank(a[0]) - rank(b[0]))
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">Step</th>
          <th scope="col">Read by</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([step, tokens]) => (
          <tr key={step}>
            <th scope="row" className="mono">{step}</th>
            <td className="mono">{tokens.join(', ')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
