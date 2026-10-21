import { describe, expect, it } from 'vitest'
import { allYearsExcept } from '../context/DashboardAccessContext'

describe('allYearsExcept', () => {
  it('hides every year but the current one', () => {
    const hidden = allYearsExcept(2026)
    expect(hidden).not.toContain(2026)
    expect(hidden).toContain(2025)
    expect(hidden).toContain(2027)
    expect(hidden).toHaveLength(100)
  })
})
