/**
 * Whether a `:hover` rule that sets a border colour would apply to `el` if
 * the pointer were over it.
 *
 * `storybook/test`'s `userEvent` dispatches synthetic events and never sets
 * `:hover`, so a story cannot hover for real and read `getComputedStyle`.
 * This asks the browser instead: it walks the live stylesheets (nested
 * `@media`/`@layer` blocks included), takes every selector that contains
 * `:hover` and whose rule sets `border-color`, strips the `:hover`, and checks
 * `el.matches()` against what is left. So `:hover:not([data-checked])` answers
 * false for a checked control and true for an unchecked one.
 *
 * A caller must assert `true` for a resting control as well as `false` for
 * the state under test. Otherwise a stylesheet with no hover rule at all
 * passes every check.
 */
export function hoverBorderRuleApplies(el: Element): boolean {
  const visit = (rules: CSSRuleList): boolean => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule) {
        if (rule.style.getPropertyValue('border-color') === '') continue
        for (const selector of rule.selectorText.split(',')) {
          if (selector.includes(':hover') && el.matches(selector.replaceAll(':hover', ''))) {
            return true
          }
        }
      } else if ('cssRules' in rule && visit((rule as CSSGroupingRule).cssRules)) {
        return true
      }
    }
    return false
  }
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue // a cross-origin sheet; none of ours are
    }
    if (visit(rules)) return true
  }
  return false
}
