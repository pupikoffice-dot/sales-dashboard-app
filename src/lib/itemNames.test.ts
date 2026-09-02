import { describe, expect, it } from 'vitest'
import { preferItemName } from './itemNames'

describe('preferItemName', () => {
  it('keeps the longer label', () => {
    expect(preferItemName('Short', 'Much longer item name')).toBe('Much longer item name')
    expect(preferItemName('Much longer item name', 'Short')).toBe('Much longer item name')
  })

  it('fills empty current from candidate', () => {
    expect(preferItemName('', 'New name')).toBe('New name')
    expect(preferItemName('  ', 'New name')).toBe('New name')
  })

  it('ignores empty candidates', () => {
    expect(preferItemName('Existing', '')).toBe('Existing')
    expect(preferItemName('Existing', null)).toBe('Existing')
  })
})
