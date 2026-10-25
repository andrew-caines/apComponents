import type { RampName, Theme } from '@ap/tokens'
import { SEMANTIC_MAP } from '@ap/tokens'

const RAMPS: RampName[] = ['brand', 'neutral', 'danger', 'warning', 'success', 'info']

/**
 * A row of decorative colour blocks. The hex values sit in a disclosure under
 * them, so they are reachable by keyboard and not only by hovering a `title`.
 */
export function RampStrip({ hexes, label }: { hexes: string[]; label: string }) {
  return (
    <figure className="stack" style={{ margin: 0 }}>
      <figcaption className="mono">{label}</figcaption>
      <div aria-hidden style={{ display: 'grid', gridTemplateColumns: `repeat(${hexes.length}, 1fr)` }}>
        {hexes.map((hex, i) => (
          <div key={i} style={{ background: hex, blockSize: '2.5rem' }} />
        ))}
      </div>
      <details>
        <summary>Hex values</summary>
        <ol className="mono">
          {hexes.map((hex, i) => (
            <li key={i}>{hex}</li>
          ))}
        </ol>
      </details>
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

// Role of each step, from ADR-0006. Index 0 is step 1.
const STEP_ROLES = [
  'App background',
  'Subtle background',
  'Component background: rest',
  'Component background: hover',
  'Component background: active',
  'Border: subtle',
  'Border: normal',
  'Border: focus',
  'Solid fill (the brand colour on the brand ramp)',
  'Solid fill: hover',
  'Low-contrast text',
  'High-contrast text',
]

/** Every step with its role, and the semantic tokens that read it, from SEMANTIC_MAP. */
export function StepRoles() {
  const byStep = new Map<number, string[]>()
  const onSolid: string[] = []
  for (const e of SEMANTIC_MAP) {
    const label = `${e.token} (${e.ramp})`
    if (e.step === 'onSolid') onSolid.push(label)
    else byStep.set(e.step, [...(byStep.get(e.step) ?? []), label])
  }
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">Step</th>
          <th scope="col">Role</th>
          <th scope="col">Read by</th>
        </tr>
      </thead>
      <tbody>
        {STEP_ROLES.map((role, i) => {
          const tokens = byStep.get(i + 1)
          return (
            <tr key={i}>
              <th scope="row" className="mono">{i + 1}</th>
              <td>{role}</td>
              <td className="mono">{tokens ? tokens.join(', ') : 'no semantic token reads it yet'}</td>
            </tr>
          )
        })}
        <tr>
          <th scope="row" className="mono">onSolid</th>
          <td>Text drawn on a solid step, chosen per ramp</td>
          <td className="mono">{onSolid.join(', ')}</td>
        </tr>
      </tbody>
    </table>
  )
}
