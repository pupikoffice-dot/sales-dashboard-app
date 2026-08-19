import type { AppGrant, GrantEffect, GrantKind, PermissionState } from '../types/permissions'

/** Composite key used only to compare "is this item checked" sets -- never persisted. */
function itemKey(kind: GrantKind, key: string, value: string | null): string {
  return `${kind}:${key}:${value ?? ''}`
}

// ---- Class editor: define mode --------------------------------------------

export interface NewGrant {
  kind: GrantKind
  key: string
  value: string | null
}

/**
 * Class editor never writes deny rows (per design spec) -- it's purely
 * additive. Returns rows to insert for newly-checked items and existing rows
 * to delete for newly-unchecked items.
 */
export function diffClassGrants(
  current: AppGrant[],
  desiredChecked: Set<string>,
): { toInsert: NewGrant[]; toDelete: AppGrant[] } {
  const currentKeys = new Map(current.map(g => [itemKey(g.kind, g.key, g.value), g]))
  const toInsert: NewGrant[] = []
  for (const k of desiredChecked) {
    if (!currentKeys.has(k)) {
      const [kind, key, value] = k.split(':') as [GrantKind, string, string]
      toInsert.push({ kind, key, value: value === '' ? null : value })
    }
  }
  const toDelete = current.filter(g => !desiredChecked.has(itemKey(g.kind, g.key, g.value)))
  return { toInsert, toDelete }
}

// ---- User editor: override mode -------------------------------------------

/** Resolves the checkbox's UI state for one item. See PermissionState's doc comment for why
 *  'off' and 'removed' are distinct rather than collapsed into one "unchecked" value. */
export function resolveOverrideState(
  classGrants: AppGrant[],
  userGrants: AppGrant[],
  kind: GrantKind,
  key: string,
  value: string | null = null,
): PermissionState {
  const classAllows = classGrants.some(g => g.kind === kind && g.key === key && g.value === value)
  const userGrant = userGrants.find(g => g.kind === kind && g.key === key && g.value === value)
  if (userGrant?.effect === 'deny') return 'removed' // an actual denial exists -- only this case gets the red badge
  if (userGrant?.effect === 'allow') return 'added'
  if (classAllows) return 'inherited'
  return 'off' // never granted, no override -- unchecked, but NOT a "removed" denial
}

export type OverrideOp =
  | { type: 'insert'; kind: GrantKind; key: string; value: string | null; effect: GrantEffect }
  | { type: 'delete'; grantId: number }

/**
 * Computes what to write when one checkbox is toggled. This is the exact
 * logic a prior review flagged: toggling something back to its inherited
 * state must DELETE the override row, never insert a redundant allow/deny
 * on top of one that already cancels out to the class's own grant.
 */
export function diffUserOverrides(
  classGrants: AppGrant[],
  userGrants: AppGrant[],
  kind: GrantKind,
  key: string,
  nextChecked: boolean,
  value: string | null = null,
): OverrideOp[] {
  const classAllows = classGrants.some(g => g.kind === kind && g.key === key && g.value === value)
  const existingOverride = userGrants.find(g => g.kind === kind && g.key === key && g.value === value) ?? null

  if (existingOverride) {
    // Toggling back to whatever the class alone would give -- always a delete.
    const overrideMakesItChecked = existingOverride.effect === 'allow'
    if (overrideMakesItChecked === nextChecked) return [] // no-op, already in the requested state
    return [{ type: 'delete', grantId: existingOverride.id }]
  }

  // No existing override: only write one if the new state differs from what the class alone gives.
  if (nextChecked === classAllows) return []
  return [{ type: 'insert', kind, key, value, effect: nextChecked ? 'allow' : 'deny' }]
}

/** Class switch: clear every existing per-user override outright (design decision, see spec). */
export function clearOverridesForClassSwitch(userGrants: AppGrant[]): { toDeleteIds: number[] } {
  return { toDeleteIds: userGrants.map(g => g.id) }
}
