import { describe, expect, it } from 'vitest'
import { yearsInCompanySales } from './salesDateFilter'

describe('yearsInCompanySales', () => {
  it('lists the years that company has, oldest first', () => {
    const rows = [
      { company: 'pupik', year: 2024 },
      { company: 'pupik', year: 2022 },
      { company: 'mt', year: 2023 },
      { company: 'pupik', year: 2026 },
      { company: 'pupik', year: 2022 },
    ]
    expect(yearsInCompanySales(rows, 'pupik')).toEqual([2022, 2024, 2026])
  })

  it('keeps 2025 and 2026 when that company has no rows yet', () => {
    expect(yearsInCompanySales([{ company: 'mt', year: 2022 }], 'pupik')).toEqual([2025, 2026])
    expect(yearsInCompanySales([], null)).toEqual([2025, 2026])
  })
})
