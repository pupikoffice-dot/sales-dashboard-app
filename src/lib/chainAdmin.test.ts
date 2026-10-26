import { describe, expect, it } from 'vitest'
import { addSummary, parseClientNumbers } from './chainAdmin'

describe('chain admin helpers', () => {
  it('reads client numbers from pasted text and drops duplicates', () => {
    expect(parseClientNumbers('2120700, 2120701\n2120700  2120702;')).toEqual(['2120700', '2120701', '2120702'])
    expect(parseClientNumbers('  \n ')).toEqual([])
  })
  it('summarises what was added and what was left out', () => {
    expect(addSummary({ added: 3 })).toBe('3 added')
    expect(addSummary({ added: 1, unknown: ['9'], inOtherChain: [{ id: '2', chain: 'MYST' }] })).toBe(
      '1 added · not found in this company: 9 · already in another chain (left as they are): 2 (MYST)',
    )
    expect(addSummary({ error: 'Unknown chain.' })).toBe('Unknown chain.')
  })
})
