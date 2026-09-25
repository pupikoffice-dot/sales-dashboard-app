import { describe, expect, it } from 'vitest'
import {
  barPct,
  buildMonthlyDeliveryBlocks,
  deliverySeriesStats,
  filterDeliveryEntities,
  lastNMonths,
} from './opsDeliveries'

const today = new Date(2026, 8, 25)

describe('lastNMonths', () => {
  it('returns newest first and crosses year boundaries', () => {
    const m = lastNMonths(12, today)
    expect(m).toHaveLength(12)
    expect(m[0].ym).toBe('2026-09')
    expect(m[8].ym).toBe('2026-01')
    expect(m[9].ym).toBe('2025-12')
    expect(m[11].ym).toBe('2025-10')
  })
})

describe('buildMonthlyDeliveryBlocks', () => {
  const rows = [
    { company: 'mt', ym: '2026-09', cartons: 137, pallets: 8 },
    { company: 'pupik', ym: '2026-09', cartons: 432, pallets: 159 },
    { company: 'pupik', ym: '2026-08', cartons: 375, pallets: 197 },
    { company: 'pupik', ym: '2024-01', cartons: 999, pallets: 999 },
  ]

  it('keeps companies separate, Pupik first, and fills empty months with 0', () => {
    const blocks = buildMonthlyDeliveryBlocks(rows, ['mt', 'pupik'], 12, today)
    expect(blocks.map(b => b.company)).toEqual(['pupik', 'mt'])
    const pupik = blocks[0]
    expect(pupik.months).toHaveLength(12)
    expect(pupik.months[0]).toMatchObject({ ym: '2026-09', cartons: 432, pallets: 159 })
    expect(pupik.months[1]).toMatchObject({ ym: '2026-08', cartons: 375, pallets: 197 })
    expect(pupik.months[2]).toMatchObject({ ym: '2026-07', cartons: 0, pallets: 0 })
    expect(pupik.maxCartons).toBe(432)
    expect(pupik.maxPallets).toBe(197)
    expect(pupik.totalCartons).toBe(807)
    expect(blocks[1].totalPallets).toBe(8)
  })

  it('omits companies outside access or without rows', () => {
    expect(buildMonthlyDeliveryBlocks(rows, ['mt'], 12, today).map(b => b.company)).toEqual(['mt'])
    expect(buildMonthlyDeliveryBlocks(rows, ['gold'], 12, today)).toEqual([])
  })
})

describe('deliverySeriesStats', () => {
  const mk = (vals: (number | null)[]) =>
    vals.map((v, i) => ({ ym: `m${i}`, year: 2026, month: i, cartons: v ?? 0, pallets: 0, hasData: v !== null }))

  it('skips months before data starts and the current partial month', () => {
    const months = mk([null, null, 10, 20, 30, 5])
    const s = deliverySeriesStats(months, months.map(m => m.cartons))!
    expect(s.fromIdx).toBe(2)
    expect(s.toIdx).toBe(4)
    expect(s.avg).toBe(20)
    expect(s.slope).toBeCloseTo(10)
    expect(s.intercept + s.slope * 2).toBeCloseTo(10)
  })

  it('uses the current month when it is the only month with data', () => {
    const months = mk([null, null, 7])
    const s = deliverySeriesStats(months, months.map(m => m.cartons))!
    expect(s).toMatchObject({ fromIdx: 2, toIdx: 2, avg: 7, slope: 0 })
  })

  it('returns null without data', () => {
    const months = mk([null, null])
    expect(deliverySeriesStats(months, [0, 0])).toBeNull()
  })
})

describe('filterDeliveryEntities', () => {
  const entities = [
    { company: 'pupik', kind: 'client' as const, entityId: '100', name: 'Shufersal Deal', cartons: 50, pallets: 2 },
    { company: 'pupik', kind: 'client' as const, entityId: '200', name: 'Rami Levy', cartons: 90, pallets: 1 },
    { company: 'pupik', kind: 'agent' as const, entityId: '24', name: 'Cash Center', cartons: 900, pallets: 9 },
    { company: 'mt', kind: 'client' as const, entityId: '300', name: 'Shufersal Online', cartons: 10, pallets: 0 },
  ]

  it('filters by company and kind, biggest volume first', () => {
    const r = filterDeliveryEntities(entities, 'pupik', 'client', '', new Set())
    expect(r.map(e => e.entityId)).toEqual(['200', '100'])
  })

  it('matches name or number and skips already-added ids', () => {
    expect(filterDeliveryEntities(entities, 'pupik', 'client', 'shuf', new Set()).map(e => e.entityId)).toEqual(['100'])
    expect(filterDeliveryEntities(entities, 'pupik', 'client', '20', new Set()).map(e => e.entityId)).toEqual(['200'])
    expect(filterDeliveryEntities(entities, 'pupik', 'client', '', new Set(['200'])).map(e => e.entityId)).toEqual(['100'])
  })
})

describe('barPct', () => {
  it('scales against max and clamps negatives', () => {
    expect(barPct(50, 200)).toBe(25)
    expect(barPct(-3, 200)).toBe(0)
    expect(barPct(5, 0)).toBe(0)
  })
})
