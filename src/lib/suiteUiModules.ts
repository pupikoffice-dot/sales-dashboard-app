import type { AppUiModule } from '../types/uiModules'

/** v1 Sales Manager suite tiles granted per-user (not via class addons). */
export const SUITE_MOUNTABLE_UI_MODULE_IDS = ['best_sold_items', 'best_clients'] as const

export type SuiteMountableUiModuleId = (typeof SUITE_MOUNTABLE_UI_MODULE_IDS)[number]

const ALLOWLIST = new Set<string>(SUITE_MOUNTABLE_UI_MODULE_IDS)

export function isSuiteMountableUiModuleId(id: string): boolean {
  return ALLOWLIST.has(id)
}

/** Class / override UI must not offer these as oversight addons. */
export function isClassGrantableUiModule(mod: AppUiModule): boolean {
  if (!mod.active || mod.surface !== 'oversight') return false
  return !isSuiteMountableUiModuleId(mod.id)
}

export interface ResolveVisibleSuiteUiArgs {
  isSuperAdmin: boolean
  isPreviewing: boolean
  grants: string[]
  catalog: AppUiModule[]
}

/** Active allowlist ids visible for the current session (mirrors BI resolve). */
export function resolveVisibleSuiteUiModuleIds(args: ResolveVisibleSuiteUiArgs): string[] {
  const active = args.catalog
    .filter(m => m.active && isSuiteMountableUiModuleId(m.id))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
  if (args.isSuperAdmin && !args.isPreviewing) {
    return active.map(m => m.id)
  }
  const grantSet = new Set(args.grants.map(String))
  return active.filter(m => grantSet.has(m.id)).map(m => m.id)
}
