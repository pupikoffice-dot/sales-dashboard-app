import { useSyncExternalStore } from 'react'

/**
 * Which older years are being downloaded right now (and which failed), shared by every component that shows a
 * year picker. A tiny external store: useDashboardData starts and ends loads, pickers only read.
 */
export interface YearLoadState {
  loading: readonly number[]
  failed: Readonly<Record<number, string>>
}

let state: YearLoadState = { loading: [], failed: {} }
const listeners = new Set<() => void>()

function set(next: YearLoadState) {
  state = next
  listeners.forEach(l => l())
}

export const yearLoadStore = {
  start(year: number) {
    const { [year]: _gone, ...failed } = state.failed
    void _gone
    set({ loading: state.loading.includes(year) ? state.loading : [...state.loading, year], failed })
  },
  end(year: number) {
    set({ ...state, loading: state.loading.filter(y => y !== year) })
  },
  fail(year: number, message: string) {
    set({ ...state, failed: { ...state.failed, [year]: message } })
  },
  reset() {
    set({ loading: [], failed: {} })
  },
  get(): YearLoadState {
    return state
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

export function useYearLoadState(): YearLoadState {
  return useSyncExternalStore(yearLoadStore.subscribe, yearLoadStore.get, yearLoadStore.get)
}
