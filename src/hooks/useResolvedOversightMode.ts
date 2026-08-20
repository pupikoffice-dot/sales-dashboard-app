import { pickOversightMode } from '../lib/uiModules'
import type { OversightMode } from '../types/uiModules'
import { useUiModules } from './useUiModules'

/**
 * Resolve Oversight layout from the effective user's class UI-module grants.
 * Uses View-as target when previewing (via useUiModules).
 */
export function useResolvedOversightMode(): OversightMode & { isLoading: boolean } {
  const { data, isLoading } = useUiModules()
  return {
    ...pickOversightMode(data ?? []),
    isLoading,
  }
}
