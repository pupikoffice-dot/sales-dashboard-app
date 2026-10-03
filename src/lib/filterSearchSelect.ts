/**
 * Typing in a sidebar checklist search.
 *
 * The first time a query starts, previous checks are dropped and only the
 * current matches stay checked. Narrowing the same query follows the matches.
 * Clearing the box keeps those checks. The next query adds its matches on top.
 */
export interface SearchSelectState {
  everSearched: boolean
  /** Checks to keep while a query is active (not the live matches). */
  baseline: string[]
  /** Matches the user unchecked during the current query. */
  excluded: string[]
}

export const emptySearchSelectState = (): SearchSelectState => ({
  everSearched: false,
  baseline: [],
  excluded: [],
})

export function applySearchTyping(
  state: SearchSelectState,
  args: { prevQuery: string; nextQuery: string; selected: string[]; matchIds: string[] },
): { state: SearchSelectState; selected: string[] | null } {
  const prev = args.prevQuery.trim()
  const next = args.nextQuery.trim()
  if (prev === next) return { state, selected: null }

  if (!next) {
    return {
      state: { ...state, baseline: args.selected, excluded: [] },
      selected: null,
    }
  }

  const starting = !prev
  const baseline = starting ? (state.everSearched ? args.selected : []) : state.baseline
  const excluded = starting ? [] : state.excluded
  const excludedSet = new Set(excluded)
  const selected = new Set(baseline)
  for (const id of args.matchIds) {
    if (!excludedSet.has(id)) selected.add(id)
  }

  return {
    state: { everSearched: true, baseline, excluded },
    selected: [...selected],
  }
}

/** Remember a manual check/uncheck while a query is active so the next keystroke keeps it. */
export function noteSearchToggle(
  state: SearchSelectState,
  id: string,
  wasChecked: boolean,
): SearchSelectState {
  const excluded = new Set(state.excluded)
  const baseline = new Set(state.baseline)
  if (wasChecked) {
    excluded.add(id)
    baseline.delete(id)
  } else {
    excluded.delete(id)
    baseline.add(id)
  }
  return { ...state, excluded: [...excluded], baseline: [...baseline] }
}
