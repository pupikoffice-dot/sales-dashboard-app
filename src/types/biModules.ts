export type BiModuleId = 'missed_items' | 'missed_clients' | 'items_sold_by_others'

export type BiNeedsAgent = 'all_or_one' | 'one_only'

export interface AppBiModule {
  id: BiModuleId | string
  label: string
  description: string | null
  needsAgent: BiNeedsAgent
  usesHabit: boolean
  active: boolean
  sortOrder: number
}

export interface AppBiConfig {
  habitX: number
  habitY: number
  updatedAt?: string
}

export interface ResolveVisibleBiArgs {
  isSuperAdmin: boolean
  isPreviewing: boolean
  /** Granted module ids for the effective user (ignored for super-admin when not previewing). */
  grants: string[]
  catalog: AppBiModule[]
}
