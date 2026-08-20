import type { OversightMode, UiModuleRef } from '../types/uiModules'

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
