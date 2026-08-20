import type {
  AppUiModule,
  OversightMode,
  UiModuleGrantKeyParts,
  UiModuleKind,
  UiModuleRef,
  UiModuleSurface,
} from '../types/uiModules'

/** Grant key prefix for Oversight UI modules (class `node` grants). */
export const UI_OVERSIGHT_GRANT_PREFIX = 'ui.oversight.'

const UI_MODULE_GRANT_KEY_RE =
  /^ui\.(oversight|sidebar)\.(suite|addon)\.([a-z0-9_]+)$/

/**
 * Build class grant key for a UI module.
 * e.g. `ui.oversight.suite.sales_manager`, `ui.oversight.addon.<id>`.
 */
export function uiModuleGrantKey(
  surface: UiModuleSurface,
  kind: UiModuleKind,
  id: string,
): string {
  return `ui.${surface}.${kind}.${id}`
}

/** Parse `ui.<surface>.<kind>.<id>`; returns null if not a UI-module grant key. */
export function parseUiModuleGrantKey(key: string): UiModuleGrantKeyParts | null {
  const m = UI_MODULE_GRANT_KEY_RE.exec(key)
  if (!m) return null
  return {
    surface: m[1] as UiModuleSurface,
    kind: m[2] as UiModuleKind,
    id: m[3],
  }
}

/**
 * Map allow grant keys onto catalog rows.
 * Skips unknown / inactive modules and surface/kind mismatches with the catalog.
 */
export function mapGrantKeysToUiModules(
  keys: string[],
  catalog: AppUiModule[],
): UiModuleRef[] {
  const byId = new Map(catalog.map((row) => [row.id, row]))
  const out: UiModuleRef[] = []
  const seen = new Set<string>()

  for (const key of keys) {
    const parsed = parseUiModuleGrantKey(key)
    if (!parsed) continue
    const mod = byId.get(parsed.id)
    if (!mod || !mod.active) continue
    if (mod.surface !== parsed.surface || mod.kind !== parsed.kind) continue
    if (seen.has(mod.id)) continue
    seen.add(mod.id)
    out.push({ id: mod.id, surface: mod.surface, kind: mod.kind })
  }

  return out
}

/**
 * Resolve Oversight layout from class UI-module grants.
 * CORE RULE: ≤1 suite; when a suite is present, ignore addons.
 */
export function pickOversightMode(modules: UiModuleRef[]): OversightMode {
  const oversight = modules.filter((m) => m.surface === 'oversight')
  const suite = oversight.find((m) => m.kind === 'suite')
  if (suite) {
    return { mode: 'suite', suiteId: suite.id }
  }
  return {
    mode: 'classic',
    addonIds: oversight.filter((m) => m.kind === 'addon').map((m) => m.id),
  }
}

/** Sort agent ERP codes ascending as numbers when numeric-ish. */
export function sortAgentIds(ids: string[]): string[] {
  return [...ids].sort((a, b) => {
    const an = Number(a)
    const bn = Number(b)
    if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn
    return a.localeCompare(b)
  })
}

/** Sum agent targets; missing / undefined treated as 0. */
export function sumGoals(
  agentIds: string[],
  targets: Record<string, number | undefined>,
): number {
  return agentIds.reduce((sum, id) => sum + (targets[id] ?? 0), 0)
}
