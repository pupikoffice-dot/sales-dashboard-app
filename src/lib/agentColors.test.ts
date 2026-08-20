import { describe, expect, it } from 'vitest'
import { AGENT_COLOR_COUNT, agentColorClass, agentColorIndex } from './agentColors'

describe('agentColorIndex', () => {
  it('is stable for the same agent id', () => {
    expect(agentColorIndex('24')).toBe(agentColorIndex('24'))
    expect(agentColorClass('24')).toBe(`agent-c${24 % AGENT_COLOR_COUNT}`)
  })

  it('gives distinct slots for Sales Manager agents 24/25/27', () => {
    const slots = ['24', '25', '27'].map(agentColorIndex)
    expect(new Set(slots).size).toBe(3)
  })
})
