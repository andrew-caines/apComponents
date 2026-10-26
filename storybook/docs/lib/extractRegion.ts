// Guides quote fixture code by named region rather than copying it, so a
// sample cannot drift from code the gates build and run (Phase 6 spec §4.0).
// Markers: `// #region docs:<name>` … `// #endregion docs:<name>`, or the JSX
// form `{/* #region docs:<name> */}`.

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Exactly one of the two forms: a `//` line, or a `{/* … */}` that closes on the same line.
const marker = (kind: 'region' | 'endregion', name: string): RegExp => {
  const body = `#${kind} docs:${escape(name)}`
  return new RegExp(`^\\s*(?:\\/\\/\\s*${body}|\\{\\/\\*\\s*${body}\\s*\\*\\/\\})\\s*$`)
}

export function extractRegion(raw: string, name: string): string {
  const lines = raw.split(/\r?\n/)
  const open = marker('region', name)
  const starts = lines.flatMap((line, i) => (open.test(line) ? [i] : []))
  if (starts.length === 0) throw new Error(`extractRegion: no region "docs:${name}"`)
  if (starts.length > 1) throw new Error(`extractRegion: region "docs:${name}" appears ${starts.length} times`)
  const start = starts[0]! + 1
  const close = marker('endregion', name)
  const length = lines.slice(start).findIndex((line) => close.test(line))
  if (length === -1) throw new Error(`extractRegion: region "docs:${name}" is not closed`)
  const body = lines.slice(start, start + length)
  const indents = body.filter((l) => l.trim() !== '').map((l) => /^\s*/.exec(l)![0].length)
  if (indents.length === 0) throw new Error(`extractRegion: region "docs:${name}" is empty`)
  const strip = Math.min(...indents)
  return body.map((l) => l.slice(strip)).join('\n')
}
