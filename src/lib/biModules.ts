import type { AppBiModule, ResolveVisibleBiArgs } from '../types/biModules'

export function validateHabitXY(x: number, y: number): string | null {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return 'X and Y must be whole numbers'
  if (x < 1 || y < 1) return 'X and Y must be at least 1'
  if (y > 24) return 'Y cannot exceed 24'
  if (x > y) return 'X cannot be greater than Y'
  return null
}

/** Active catalog ids visible for the current session. */
export function resolveVisibleBiModuleIds(args: ResolveVisibleBiArgs): string[] {
  const active = args.catalog.filter(m => m.active).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
  if (args.isSuperAdmin && !args.isPreviewing) {
    return active.map(m => m.id)
  }
  const grantSet = new Set(args.grants.map(String))
  return active.filter(m => grantSet.has(m.id)).map(m => m.id)
}

export function mapBiModuleRow(row: Record<string, unknown>): AppBiModule {
  return {
    id: String(row.id),
    label: String(row.label ?? row.id),
    description: row.description == null ? null : String(row.description),
    needsAgent: row.needs_agent === 'one_only' ? 'one_only' : 'all_or_one',
    usesHabit: row.uses_habit === true,
    active: row.active !== false,
    sortOrder: Number(row.sort_order) || 100,
  }
}
