import type { IconDefinition, IconInput } from './types.js'

const BRAND = Symbol.for('ap.icon')
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/

function checkPaths(name: string, paths: readonly unknown[]): void {
  if (!paths.every((p) => typeof p === 'string' && p.length > 0)) {
    throw new Error(`defineIcon(${name}): every path must be a non-empty string`)
  }
}

function validViewBox(viewBox: unknown): boolean {
  if (typeof viewBox !== 'string') return false
  const parts = viewBox.trim().split(/[\s,]+/)
  if (parts.length !== 4) return false
  const nums = parts.map(Number)
  if (!nums.every(Number.isFinite)) return false
  return nums[2]! > 0 && nums[3]! > 0
}

export function defineIcon(input: IconInput): IconDefinition {
  const { name, primary, secondary, viewBox } = input
  if (typeof name !== 'string' || !NAME.test(name)) {
    throw new Error(`defineIcon: name "${String(name)}" must be kebab-case`)
  }
  if (!Array.isArray(primary) || primary.length === 0) {
    throw new Error(`defineIcon(${name}): primary must contain at least one path`)
  }
  checkPaths(name, primary)
  if (secondary !== undefined && secondary !== 'halo') {
    if (!Array.isArray(secondary) || secondary.length === 0) {
      throw new Error(
        `defineIcon(${name}): secondary must be 'halo' or a non-empty array of paths`,
      )
    }
    checkPaths(name, secondary)
  }
  if (viewBox !== undefined && !validViewBox(viewBox)) {
    throw new Error(
      `defineIcon(${name}): viewBox "${String(viewBox)}" must be four numbers with positive width and height`,
    )
  }
  const def = {
    name,
    primary: Object.freeze([...primary]),
    ...(secondary !== undefined && {
      secondary: secondary === 'halo' ? secondary : Object.freeze([...secondary]),
    }),
    ...(viewBox !== undefined && { viewBox }),
  }
  Object.defineProperty(def, BRAND, { value: true })
  return Object.freeze(def)
}

export function isIconDefinition(value: unknown): value is IconDefinition {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<symbol, unknown>)[BRAND] === true
  )
}
