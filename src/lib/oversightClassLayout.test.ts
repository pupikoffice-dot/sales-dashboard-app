import { describe, expect, it } from 'vitest'
import {
  normalizeBoard,
  packRows,
  parseClassLayout,
  seedSuiteBoard,
  suiteKindFromGrantKeys,
  visibleCards,
} from './oversightClassLayout'

describe('normalizeBoard', () => {
  it('drops unknown ids and appends omitted known cards', () => {
    const board = normalizeBoard(
      {
        cards: [
          { id: 'ordersToday', width: 'full', hidden: false },
          { id: 'nope', width: 'half', hidden: false },
        ],
      },
      'classic',
      'manager',
    )
    expect(board.cards[0]).toEqual({ id: 'ordersToday', width: 'full', hidden: false })
    expect(board.cards.some(c => c.id === 'nope')).toBe(false)
    expect(board.cards.map(c => c.id)).toContain('stockAlerts')
    expect(board.cards.find(c => c.id === 'salesMtd')?.width).toBe('third')
  })

  it('falls back on bad width and style', () => {
    const board = normalizeBoard(
      {
        cards: [{ id: 'salesMtd', width: 'wide', hidden: 'yes' }],
        style: { accent: 'pink', density: 'huge', cardStyle: 'glass' },
      },
      'classic',
      'manager',
    )
    expect(board.cards[0]?.width).toBe('third')
    expect(board.cards[0]?.hidden).toBe(false)
    expect(board.style).toEqual({ accent: 'indigo', density: 'comfortable', cardStyle: 'soft' })
  })
})

describe('seedSuiteBoard', () => {
  it('hides the 7-day chart only on the Sales Agent seed', () => {
    expect(seedSuiteBoard('agent').cards.find(c => c.id === 'ordersLast7')?.hidden).toBe(true)
    expect(seedSuiteBoard('manager').cards.find(c => c.id === 'ordersLast7')?.hidden).toBe(false)
  })
})

describe('packRows', () => {
  it('keeps half + third on one row and wraps a following full', () => {
    const rows = packRows([
      { id: 'a', width: 'half', hidden: false },
      { id: 'b', width: 'third', hidden: false },
      { id: 'c', width: 'full', hidden: false },
    ])
    expect(rows).toEqual([
      [
        { id: 'a', width: 'half', hidden: false },
        { id: 'b', width: 'third', hidden: false },
      ],
      [{ id: 'c', width: 'full', hidden: false }],
    ])
  })
})

describe('visibleCards / suiteKindFromGrantKeys', () => {
  it('hides hidden cards', () => {
    expect(
      visibleCards({
        cards: [
          { id: 'a', width: 'full', hidden: true },
          { id: 'b', width: 'full', hidden: false },
        ],
        style: { accent: 'indigo', density: 'comfortable', cardStyle: 'soft' },
      }).map(c => c.id),
    ).toEqual(['b'])
  })

  it('reads Sales Agent from grant keys', () => {
    expect(suiteKindFromGrantKeys(['node:ui.oversight.suite.sales_agent:'])).toBe('agent')
    expect(suiteKindFromGrantKeys(['ui.oversight.suite.sales_manager'])).toBe('manager')
  })
})

describe('parseClassLayout', () => {
  it('fills both boards from empty input', () => {
    const layout = parseClassLayout(null, 'agent')
    expect(layout.classic.cards).toHaveLength(10)
    expect(layout.suite.cards.find(c => c.id === 'ordersLast7')?.hidden).toBe(true)
  })
})
