import { describe, expect, it } from 'vitest'
import { applySearchTyping, emptySearchSelectState, noteSearchToggle } from './filterSearchSelect'

const items = ['GRB-1', 'GRB-678', 'GRB-678755', 'VTH-1', 'FNK-2', 'OTHER']

function matches(q: string) {
  const query = q.toLowerCase()
  return items.filter(id => id.toLowerCase().startsWith(query))
}

describe('applySearchTyping', () => {
  it('clears existing checks on the first keystroke and checks only the matches', () => {
    const start = applySearchTyping(emptySearchSelectState(), {
      prevQuery: '',
      nextQuery: 'g',
      selected: items,
      matchIds: matches('g'),
    })
    expect(start.selected?.sort()).toEqual(['GRB-1', 'GRB-678', 'GRB-678755'])

    const narrowed = applySearchTyping(start.state, {
      prevQuery: 'g',
      nextQuery: 'grb-678',
      selected: start.selected!,
      matchIds: matches('grb-678'),
    })
    expect(narrowed.selected?.sort()).toEqual(['GRB-678', 'GRB-678755'])
  })

  it('keeps the checks when the box is cleared, then adds the next search', () => {
    const first = applySearchTyping(emptySearchSelectState(), {
      prevQuery: '',
      nextQuery: 'grb-678',
      selected: items,
      matchIds: matches('grb-678'),
    })
    const cleared = applySearchTyping(first.state, {
      prevQuery: 'grb-678',
      nextQuery: '',
      selected: first.selected!,
      matchIds: items,
    })
    expect(cleared.selected).toBeNull()

    const second = applySearchTyping(cleared.state, {
      prevQuery: '',
      nextQuery: 'vth',
      selected: first.selected!,
      matchIds: matches('vth'),
    })
    expect(second.selected?.sort()).toEqual(['GRB-678', 'GRB-678755', 'VTH-1'])
  })

  it('does not bring back a match the user unchecked while typing', () => {
    const first = applySearchTyping(emptySearchSelectState(), {
      prevQuery: '',
      nextQuery: 'grb',
      selected: [],
      matchIds: matches('grb'),
    })
    const afterToggle = noteSearchToggle(first.state, 'GRB-1', true)
    const next = applySearchTyping(afterToggle, {
      prevQuery: 'grb',
      nextQuery: 'grb-',
      selected: first.selected!.filter(id => id !== 'GRB-1'),
      matchIds: matches('grb-'),
    })
    expect(next.selected).not.toContain('GRB-1')
    expect(next.selected).toContain('GRB-678')
  })
})
