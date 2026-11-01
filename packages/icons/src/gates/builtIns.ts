import { isIconDefinition } from '../define.js'
import type { IconDefinition } from '../types.js'

export function pascalCase(name: string): string {
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

/** `[exportName, definition]` for every icon definition exported from the package entry. */
export async function builtInEntries(): Promise<[string, IconDefinition][]> {
  const mod: Record<string, unknown> = await import('../index.js')
  return Object.entries(mod).filter((entry): entry is [string, IconDefinition] =>
    isIconDefinition(entry[1]),
  )
}

export async function builtIns(): Promise<IconDefinition[]> {
  return (await builtInEntries()).map(([, def]) => def)
}
