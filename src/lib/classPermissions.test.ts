import { describe, expect, it } from 'vitest'
import {
  clearOverridesForClassSwitch,
  diffClassGrants,
  diffUserOverrides,
  resolveOverrideState,
} from './classPermissions'
import type { AppGrant } from '../types/permissions'

const classGrant = (kind: AppGrant['kind'], key: string, value: string | null = null): AppGrant => ({
  id: 0, classId: 'c1', userId: null, kind, key, value, effect: 'allow',
})
const userGrant = (
  kind: AppGrant['kind'], key: string, effect: AppGrant['effect'], value: string | null = null,
): AppGrant => ({ id: 0, classId: null, userId: 'u1', kind, key, value, effect })

describe('diffClassGrants', () => {
  it('inserts grants for newly-checked items and deletes for unchecked', () => {
    const current = [classGrant('field', 'item_cost')]
    const desiredChecked = new Set(['field:item_cost:', 'field:client_profit:'])
    const { toInsert, toDelete } = diffClassGrants(current, desiredChecked)
    expect(toInsert).toEqual([{ kind: 'field', key: 'client_profit', value: null }])
    expect(toDelete.map(g => g.id)).toEqual([]) // current row has id 0 (test fixture) but is kept
  })

  it('never produces a deny row', () => {
    const { toInsert } = diffClassGrants([], new Set(['scope:company:pupik']))
    expect(toInsert.every(g => !('effect' in g))).toBe(true) // class inserts are always allow, implicit
  })

  it('preserves a non-null value through the insert (not mangled by the string-key parsing)', () => {
    const { toInsert } = diffClassGrants([], new Set(['scope:company:pupik']))
    expect(toInsert).toEqual([{ kind: 'scope', key: 'company', value: 'pupik' }])
  })
})

describe('resolveOverrideState — the three-state UI logic', () => {
  it('is "inherited" when the class grants it and the user has no override', () => {
    const state = resolveOverrideState([classGrant('field', 'item_cost')], [], 'field', 'item_cost')
    expect(state).toBe('inherited')
  })

  it('is "added" when the user has an allow the class does not grant', () => {
    const state = resolveOverrideState([], [userGrant('field', 'item_cost', 'allow')], 'field', 'item_cost')
    expect(state).toBe('added')
  })

  it('is "removed" when the user denies something the class grants', () => {
    const state = resolveOverrideState(
      [classGrant('field', 'item_cost')], [userGrant('field', 'item_cost', 'deny')], 'field', 'item_cost',
    )
    expect(state).toBe('removed')
  })

  it('is "off" -- NOT "removed" -- when neither the class nor any override grants it', () => {
    // The bug this guards against: an earlier draft collapsed "never granted"
    // into the same fallback as "explicitly denied," which would have shown
    // a misleading "removed" badge on every item outside a class's actual
    // grants (e.g. 3 of 4 companies for a single-company class).
    const state = resolveOverrideState([], [], 'scope', 'company', 'gold')
    expect(state).toBe('off')
    expect(state).not.toBe('removed')
  })

  it('a deny on one value does not affect a different value of the same key', () => {
    // Class grants mt; user denies pupik. mt must stay 'inherited', unaffected by the pupik deny.
    const state = resolveOverrideState(
      [classGrant('scope', 'company', 'mt')],
      [userGrant('scope', 'company', 'deny', 'pupik')],
      'scope', 'company', 'mt',
    )
    expect(state).toBe('inherited')
  })
})

describe('diffUserOverrides — toggle transitions (the risky part)', () => {
  it('toggling an inherited item OFF writes a deny row', () => {
    const ops = diffUserOverrides(
      [classGrant('field', 'item_cost')], [], 'field', 'item_cost', /* nextChecked */ false,
    )
    expect(ops).toEqual([{ type: 'insert', kind: 'field', key: 'item_cost', value: null, effect: 'deny' }])
  })

  it('toggling a "removed" item back ON deletes the deny row -- NOT a redundant allow insert', () => {
    const existingDeny = userGrant('field', 'item_cost', 'deny')
    const ops = diffUserOverrides(
      [classGrant('field', 'item_cost')], [existingDeny], 'field', 'item_cost', /* nextChecked */ true,
    )
    expect(ops).toEqual([{ type: 'delete', grantId: existingDeny.id }])
  })

  it('toggling a not-in-class item ON writes an allow row', () => {
    const ops = diffUserOverrides([], [], 'scope', 'company', /* nextChecked */ true, 'grow')
    expect(ops).toEqual([{ type: 'insert', kind: 'scope', key: 'company', value: 'grow', effect: 'allow' }])
  })

  it('toggling an "added" item back OFF deletes the allow row', () => {
    const existingAllow = userGrant('scope', 'company', 'allow', 'grow')
    const ops = diffUserOverrides(
      [], [existingAllow], 'scope', 'company', /* nextChecked */ false, 'grow',
    )
    expect(ops).toEqual([{ type: 'delete', grantId: existingAllow.id }])
  })
})

describe('class switch clears all user overrides', () => {
  it('returns every user-owned grant id for deletion, and nothing else', () => {
    const overrides = [userGrant('field', 'item_cost', 'allow'), userGrant('scope', 'agent', 'deny', '24')]
    const { toDeleteIds } = clearOverridesForClassSwitch(overrides)
    expect(toDeleteIds.sort()).toEqual(overrides.map(g => g.id).sort())
  })
})
