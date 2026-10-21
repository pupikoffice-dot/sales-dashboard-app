import { rowYear } from './permissions'

/**
 * Years an admin can show or hide for a user: every year found in the data, the current year, and any year already
 * hidden for this user (so a hidden year never disappears from the list). Newest first.
 */
export function yearChoices(
  rows: ReadonlyArray<{ year?: unknown; date?: unknown }>,
  hiddenYears: readonly number[],
  currentYear = new Date().getFullYear(),
): number[] {
  const years = new Set<number>([currentYear, ...hiddenYears.map(Number)])
  for (const r of rows) {
    const y = rowYear(r)
    if (y != null) years.add(y)
  }
  return [...years].filter(y => Number.isInteger(y)).sort((a, b) => b - a)
}

/** Toggle one year in the hidden list; the list stays sorted and without duplicates. */
export function toggleHiddenYear(hiddenYears: readonly number[], year: number): number[] {
  const next = hiddenYears.includes(year) ? hiddenYears.filter(y => y !== year) : [...hiddenYears, year]
  return [...new Set(next)].sort((a, b) => a - b)
}
