// Test-only. A focused extractor for the CSS this repo generates — not a
// general CSS parser, and it should never become one. Its job is to read the
// committed `motion.css` back out, so the equivalence gate compares the
// shipped artifact against the JS emitter's output rather than comparing the
// CSS emitter with itself.

export interface ParsedStep {
  at: number
  props: Record<string, string>
}

/** One `--ap-motion-*: <name> <duration> <ease> <iterations> <fill>;` declaration. */
export interface ParsedComposite {
  /** The declaration name, verbatim (e.g. `--ap-motion-error-shake`). */
  property: string
  /**
   * The key this composite is matched to a `@keyframes` block by: the
   * property name with `--ap-motion-` swapped for `ap-` (so
   * `--ap-motion-error-shake` → `ap-error-shake`). Derived from the PROPERTY,
   * never from the animation-name term — see `name`.
   */
  key: string
  /**
   * The animation-name term, verbatim. The property name and this term are
   * two independent things: a composite can name keyframes that belong to a
   * different motion entirely, which is a real drift the gate has to catch,
   * so both are carried and the gate asserts they agree.
   */
  name: string
  /**
   * The duration term, verbatim (e.g. `var(--ap-duration-slow)`).
   * Deliberately NOT reduced to the bare token name here — `varRe` accepts
   * any value in this position so a hardcoded duration still parses instead
   * of failing collection with a misleading "no composite property" error.
   * Callers assert the `var(--ap-duration-*)` shape themselves and compare
   * the extracted token against the record.
   */
  duration: string
  /** The easing term, verbatim. See `duration`. */
  ease: string
  iterations: string
  /** The animation-fill-mode term, verbatim. See `duration`. */
  fill: string
}

export interface ParsedMotion extends Omit<ParsedComposite, 'property' | 'key'> {
  steps: ParsedStep[]
}

export interface ParsedCss {
  normal: Record<string, ParsedMotion>
  reduced: Record<string, ParsedStep[]>
  /**
   * EVERY `--ap-motion-*` declaration in the sheet, wherever it sits — inside
   * the token layer, after it, unlayered, or inside the reduced-motion block
   * — in source order, duplicates included. Scanning only the text before the
   * media block, or only the first `@layer ap.tokens` block, would leave a
   * later redeclaration that wins the cascade completely unseen. The parser
   * reports what is there; the gate asserts there are exactly twelve, one per
   * motion.
   */
  composites: ParsedComposite[]
}

/**
 * Index of the `{` that closes the block opened by the `{` at `openIndex`,
 * found by counting nested braces. Pattern-matching (e.g. `lastIndexOf('}')`)
 * cannot prove containment when the outer block itself contains other
 * `{...}` blocks — it just finds *a* closing brace, not necessarily the one
 * that matches this opener.
 *
 * Exported for `../emitCss.test.ts`, which needs the same brace walk. This
 * module is test-only and is NOT re-exported from `@ap/motion`'s public API,
 * so sharing it within the package costs nothing. `packages/tokens/src/emit/
 * cssText.test.ts` keeps its own copy: sharing across a package boundary
 * would mean exporting a test-only utility from `@ap/tokens`, which costs
 * more than the duplication saves.
 */
export function matchingClose(source: string, openIndex: number): number {
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
  // `indexOf` finds the first `{` anywhere after the opener, not necessarily
  // one that belongs to it — if the opener text and that brace aren't
  // adjacent but for whitespace, the brace belongs to something else
  // entirely (e.g. a later @keyframes rule), and slicing from it would
  // silently mis-slice that unrelated rule in as the reduced body.
  const between = css.slice(reducedAt + OPENER.length, openBrace)
  if (between.trim() !== '') {
    throw new Error(
      `prefers-reduced-motion block opener is not immediately followed by its opening brace: ${JSON.stringify(between)}`,
    )
  }
  const closeBrace = matchingClose(css, openBrace)

  const before = css.slice(0, reducedAt)
  const reducedBody = css.slice(openBrace + 1, closeBrace)

  // Every term after the property name is captured as an opaque `\S+` token
  // rather than as the shape it is supposed to have (`var(--ap-duration-...)`,
  // `both`, and so on). Requiring those shapes here means a perturbed value
  // (a duration replaced with `320ms`, a fill mode changed to `forwards`)
  // fails the WHOLE composite-property match, and collection throws "no
  // --ap-motion-* composite property" — naming the wrong seam, since the
  // keyframe is fine and the disagreement is in one term. Accepting any token
  // lets the perturbed value parse through to the gate, which asserts each
  // term's shape and fails there instead, naming the term directly.
  //
  // Scanned over the WHOLE sheet, not just the text before the media block:
  // a `--ap-motion-*` declaration after the token layer, or inside the
  // reduced-motion block, wins the cascade and is exactly the drift worth
  // catching. The gate asserts the count.
  const varRe = /(--ap-motion-([a-z0-9-]+)):\s*(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+);/g
  const composites: ParsedComposite[] = []
  const composite = new Map<string, ParsedComposite>()
  let v: RegExpExecArray | null
  while ((v = varRe.exec(css)) !== null) {
    const parsed: ParsedComposite = {
      property: v[1]!,
      key: `ap-${v[2]!}`,
      name: v[3]!,
      duration: v[4]!,
      ease: v[5]!,
      iterations: v[6]!,
      fill: v[7]!,
    }
    composites.push(parsed)
    composite.set(parsed.key, parsed)
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
    const { property: _property, key: _key, ...terms } = c
    normal[kf] = { steps, ...terms }
  }

  return { normal, reduced: collect(reducedBody), composites }
}
