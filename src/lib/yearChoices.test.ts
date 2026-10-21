import { describe, expect, it } from 'vitest'
import { toggleHiddenYear, yearChoices } from './yearChoices'

describe('year choices for the admin screen', () => {
  it('lists data years, the current year and already hidden years, newest first', () => {
    const rows = [{ year: 2024 }, { year: 2025 }, { date: '2022-05-01' }, { year: 2024 }, {}]
    expect(yearChoices(rows, [2019], 2026)).toEqual([2026, 2025, 2024, 2022, 2019])
  })

  it('works with no data at all', () => {
    expect(yearChoices([], [], 2026)).toEqual([2026])
  })

  it('toggles a year in and out of the hidden list, sorted and unique', () => {
    expect(toggleHiddenYear([], 2025)).toEqual([2025])
    expect(toggleHiddenYear([2025], 2023)).toEqual([2023, 2025])
    expect(toggleHiddenYear([2023, 2025], 2025)).toEqual([2023])
    expect(toggleHiddenYear([2023], 2023)).toEqual([])
  })
})
