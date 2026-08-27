import type { OversightMode } from '../types/uiModules'

/** Per-user alternate Oversight layouts (stored in `dashboard_user_ui`). */
export const OVERSIGHT_ALTERNATE_LAYOUT_IDS = ['sales_manager'] as const

export type OversightAlternateLayoutId = (typeof OVERSIGHT_ALTERNATE_LAYOUT_IDS)[number]

const ALLOWLIST = new Set<string>(OVERSIGHT_ALTERNATE_LAYOUT_IDS)

export function isOversightAlternateLayoutId(id: string): boolean {
  return ALLOWLIST.has(id)
}

export type OversightLayoutPreference = 'classic' | { suiteId: string }

export interface ResolveOversightDisplayArgs {
  /** Layout forced by class UI-module grants. */
  classMode: OversightMode
  /** Per-user alternate layout ids (e.g. sales_manager). */
  alternateLayoutIds: string[]
  /** Saved preference; null/undefined → default classic when both available. */
  preference: OversightLayoutPreference | null | undefined
}

export interface OversightDisplayResolution {
  display: OversightMode
  canToggle: boolean
  /** Classic is always first when both are available. */
  options: Array<'classic' | { suiteId: string }>
}

/**
 * Resolve which Oversight layout to show.
 * - Class suite grant → suite only (no toggle; unchanged for suite classes).
 * - Classic class + user alternate layout grant → both; default classic.
 */
export function resolveOversightDisplay(args: ResolveOversightDisplayArgs): OversightDisplayResolution {
  if (args.classMode.mode === 'suite') {
    return {
      display: args.classMode,
      canToggle: false,
      options: [{ suiteId: args.classMode.suiteId }],
    }
  }

  const suites = [
    ...new Set(
      args.alternateLayoutIds
        .map(String)
        .filter(isOversightAlternateLayoutId),
    ),
  ].map(suiteId => ({ suiteId }))

  if (suites.length === 0) {
    return {
      display: args.classMode,
      canToggle: false,
      options: ['classic'],
    }
  }

  const options: Array<'classic' | { suiteId: string }> = ['classic', ...suites]
  const pref = args.preference
  if (pref && typeof pref === 'object' && pref.suiteId) {
    const match = suites.find(s => s.suiteId === pref.suiteId)
    if (match) {
      return {
        display: { mode: 'suite', suiteId: match.suiteId },
        canToggle: true,
        options,
      }
    }
  }

  return {
    display: args.classMode,
    canToggle: true,
    options,
  }
}

const PREF_KEY_PREFIX = 'oversight-layout-pref:'

export function oversightLayoutPrefStorageKey(userId: string): string {
  return `${PREF_KEY_PREFIX}${userId}`
}

export function readOversightLayoutPreference(userId: string): OversightLayoutPreference | null {
  try {
    const raw = localStorage.getItem(oversightLayoutPrefStorageKey(userId))
    if (!raw) return null
    if (raw === 'classic') return 'classic'
    if (raw.startsWith('suite:')) {
      const suiteId = raw.slice('suite:'.length)
      if (suiteId) return { suiteId }
    }
  } catch {
    /* ignore */
  }
  return null
}

export function writeOversightLayoutPreference(
  userId: string,
  preference: OversightLayoutPreference,
): void {
  try {
    const value =
      preference === 'classic' ? 'classic' : `suite:${preference.suiteId}`
    localStorage.setItem(oversightLayoutPrefStorageKey(userId), value)
  } catch {
    /* ignore */
  }
}
