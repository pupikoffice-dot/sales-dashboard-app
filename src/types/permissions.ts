export type GrantKind = 'scope' | 'field' | 'node'
export type GrantEffect = 'allow' | 'deny'

export interface AppClass {
  id: string
  label: string
  description: string | null
  sortOrder: number
  active: boolean
}

export interface AppGrant {
  id: number
  classId: string | null
  userId: string | null
  kind: GrantKind
  key: string
  value: string | null
  effect: GrantEffect
}

/**
 * One checkbox's resolved state in "override" mode.
 * 'off' is distinct from 'removed': 'removed' means an actual user-level `deny`
 * grant overrides something the class grants (an admin's deliberate choice).
 * 'off' means the class simply never granted this item and no override exists
 * either -- nothing was ever "removed", it just isn't checked. Both render
 * unchecked, but only 'removed' shows the red "removed" badge -- otherwise
 * every item outside a class's actual grants would misleadingly look like an
 * explicit denial. (Caught during implementation, not in the original design
 * review's three-state framing -- see plan revision notes, Task 5.)
 */
export type PermissionState = 'inherited' | 'added' | 'removed' | 'off'

export interface ExplainRow {
  source: string
  effect: GrantEffect
  value: string | null
  winning: boolean
}
