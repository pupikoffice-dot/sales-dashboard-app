import { describe, expect, it } from 'vitest'
import {
  cardCols,
  moveCardById,
  normalizeBoard,
  packRows,
  parseClassLayout,
  seedSuiteBoard,
  setCardHidden,
  setCardSize,
  suiteKindFromGrantKeys,
  visibleCards,
  WIDTH_COLS,
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
    expect(board.cards[0]).toMatchObject({
      id: 'ordersToday',
      width: 'full',
      cols: 12,
      heightPx: null,
      hidden: false,
    })
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
    expect(board.cards[0]?.cols).toBe(4)
    expect(board.cards[0]?.hidden).toBe(false)
    expect(board.style).toEqual({ accent: 'indigo', density: 'comfortable', cardStyle: 'soft' })
  })

  it('keeps custom cols and height from mouse resize', () => {
    const board = normalizeBoard(
      {
        cards: [{ id: 'salesMtd', width: 'third', cols: 8, heightPx: 240, hidden: false }],
      },
      'classic',
      'manager',
    )
    expect(board.cards[0]).toMatchObject({
      id: 'salesMtd',
      width: 'half',
      cols: 8,
      heightPx: 240,
    })
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
      { id: 'a', width: 'half', cols: 6, heightPx: null, hidden: false },
      { id: 'b', width: 'third', cols: 4, heightPx: null, hidden: false },
      { id: 'c', width: 'full', cols: 12, heightPx: null, hidden: false },
    ])
    expect(rows.map(r => r.map(c => c.id))).toEqual([['a', 'b'], ['c']])
  })

  it('wraps custom cols that do not fit', () => {
    const rows = packRows([
      { id: 'a', width: 'half', cols: 8, heightPx: null, hidden: false },
      { id: 'b', width: 'half', cols: 6, heightPx: null, hidden: false },
    ])
    expect(rows.map(r => r.map(c => c.id))).toEqual([['a'], ['b']])
  })
})

describe('visibleCards / suiteKindFromGrantKeys', () => {
  it('hides hidden cards', () => {
    expect(
      visibleCards({
        cards: [
          { id: 'a', width: 'full', cols: 12, heightPx: null, hidden: true },
          { id: 'b', width: 'full', cols: 12, heightPx: null, hidden: false },
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

describe('moveCardById / setCardHidden / setCardSize', () => {
  const cards = [
    { id: 'a', width: 'full' as const, cols: 12, heightPx: null as number | null, hidden: false },
    { id: 'b', width: 'half' as const, cols: 6, heightPx: null as number | null, hidden: true },
    { id: 'c', width: 'third' as const, cols: 4, heightPx: null as number | null, hidden: false },
  ]

  it('moves by id', () => {
    expect(moveCardById(cards, 'c', 'a').map(c => c.id)).toEqual(['c', 'a', 'b'])
  })

  it('toggles hidden without changing order', () => {
    expect(setCardHidden(cards, 'b', false).map(c => ({ id: c.id, hidden: c.hidden }))).toEqual([
      { id: 'a', hidden: false },
      { id: 'b', hidden: false },
      { id: 'c', hidden: false },
    ])
  })

  it('updates cols and height from mouse resize', () => {
    const next = setCardSize(cards, 'c', { cols: 9, heightPx: 300 })
    expect(cardCols(next[2]!)).toBe(9)
    expect(next[2]?.width).toBe('half')
    expect(next[2]?.heightPx).toBe(300)
    expect(WIDTH_COLS.half).toBe(6)
  })
})

describe('parseClassLayout', () => {
  it('fills both boards from empty input', () => {
    const layout = parseClassLayout(null, 'agent')
    expect(layout.classic.cards).toHaveLength(10)
    expect(layout.suite.cards.find(c => c.id === 'ordersLast7')?.hidden).toBe(true)
  })
})
