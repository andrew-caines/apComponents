/**
 * Declare a Tier 3 (component-level) token that falls back to a Tier 2
 * semantic value. Components read Tier 3; a product overriding
 * `--ap-surface-bg` changes one component, overriding the Tier 2 token
 * changes the theme. See ADR-0007.
 *
 * @param name  token name WITHOUT the `--ap-` prefix, e.g. `surface-bg`
 * @param fallback  the Tier 2 value, normally `vars.color.*`
 */
export function tier3(name: string, fallback: string): string {
  if (name.startsWith('--')) {
    throw new Error(`tier3() takes a token name without the --ap- prefix, got: ${name}`)
  }
  return `var(--ap-${name}, ${fallback})`
}
