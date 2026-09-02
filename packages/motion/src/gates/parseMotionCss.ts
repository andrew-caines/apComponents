// Test-only. A focused extractor for the CSS this repo generates — not a
// general CSS parser, and it should never become one. Its job is to read the
// emitted artifact back so the equivalence gate compares two artifacts rather
// than trusting one emitter's in-memory state.

export interface ParsedStep {
  at: number
  props: Record<string, string>
}

export interface ParsedMotion {
  steps: ParsedStep[]
  duration: string
  ease: string
  iterations: string
}

export interface ParsedCss {
  normal: Record<string, ParsedMotion>
  reduced: Record<string, ParsedStep[]>
}

/**
 * Index of the `{` that closes the block opened by the `{` at `openIndex`,
 * found by counting nested braces. Pattern-matching (e.g. `lastIndexOf('}')`)
 * cannot prove containment when the outer block itself contains other
 * `{...}` blocks — it just finds *a* closing brace, not necessarily the one
 * that matches this opener.
 *
 * Deliberate copy of the identical helper in `../emitCss.test.ts` and
 * `packages/tokens/src/emit/cssText.test.ts` — kept local rather than shared
 * because sharing it would mean exporting a test-only utility from a
 * package's public API.
 */
function matchingClose(source: string, openIndex: number): number {
  let depth = 0
  for (let i = openIndex; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  throw new Error(`no matching close brace found for opener at index ${openIndex}`)
}

/**
 * '16.7' → 0.167, exactly. Plain `Number(pct) / 100` round-trips through
 * binary floating point and lands on 0.16699999999999998, which is a parsing
 * artifact of this function, not a disagreement between the CSS and JS
 * emitters — rounded away the same way emitCss.ts's own `offset()` trims
 * float noise on the way out. Ten decimal places is far past the precision
 * any offset in this repo is declared to.
 */
const percentToUnit = (pct: string): number => Math.round((Number(pct) / 100) * 1e10) / 1e10

const stepsOf = (body: string): ParsedStep[] => {
  const steps: ParsedStep[] = []
  const re = /([\d.]+)%(?:\s*,\s*([\d.]+)%)?\s*\{([^}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    const props: Record<string, string> = {}
    for (const decl of m[3]!.split(';')) {
      const [k, ...rest] = decl.split(':')
      if (!k?.trim() || rest.length === 0) continue
      props[k.trim()] = rest.join(':').trim()
    }
    steps.push({ at: percentToUnit(m[1]!), props })
    // A `0%, 100% { }` stop declares two offsets; record both so an empty
    // reduced block is still visibly a two-stop animation.
    if (m[2] !== undefined) steps.push({ at: percentToUnit(m[2]), props })
  }
  return steps
}

export function parseMotionCss(css: string): ParsedCss {
  const OPENER = '@media (prefers-reduced-motion: reduce)'
  const reducedAt = css.indexOf(OPENER)
  if (reducedAt === -1) throw new Error('no prefers-reduced-motion block in motion.css')

  // Slice the MATCHED block span via a brace-depth walk, not "everything
  // textually after the opener" — the latter would silently absorb any
  // content that happens to follow the media block into `reduced`.
  const openBrace = css.indexOf('{', reducedAt)
  if (openBrace === -1) {
    throw new Error('prefers-reduced-motion block has no opening brace')
  }
  const closeBrace = matchingClose(css, openBrace)

  const before = css.slice(0, reducedAt)
  const reducedBody = css.slice(openBrace + 1, closeBrace)

  const composite = new Map<string, { duration: string; ease: string; iterations: string }>()
  const varRe =
    /--ap-motion-([a-z0-9-]+):\s*\S+\s+var\(--ap-duration-([a-z]+)\)\s+var\(--ap-ease-([a-z-]+)\)\s+(\S+)\s+both;/g
  let v: RegExpExecArray | null
  while ((v = varRe.exec(before)) !== null) {
    composite.set(`ap-${v[1]}`, { duration: v[2]!, ease: v[3]!, iterations: v[4]! })
  }

  const collect = (source: string): Record<string, ParsedStep[]> => {
    const out: Record<string, ParsedStep[]> = {}
    const re = /@keyframes\s+(ap-[a-z0-9-]+)\s*\{([\s\S]*?)\n\s*\}/g
    let m: RegExpExecArray | null
    while ((m = re.exec(source)) !== null) out[m[1]!] = stepsOf(m[2]!)
    return out
  }

  const normalSteps = collect(before)
  const normal: Record<string, ParsedMotion> = {}
  for (const [kf, steps] of Object.entries(normalSteps)) {
    const c = composite.get(kf)
    if (!c) throw new Error(`@keyframes ${kf} has no --ap-motion-* composite property`)
    normal[kf] = { steps, ...c }
  }

  return { normal, reduced: collect(reducedBody) }
}
