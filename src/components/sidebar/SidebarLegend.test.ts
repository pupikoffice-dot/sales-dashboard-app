import { describe, it, expect, vi, afterEach } from 'vitest'
import { hasSeenSidebarLegend, markSidebarLegendSeen } from './SidebarLegend'

describe('sidebar legend seen-flag storage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('is unseen by default', () => {
    expect(hasSeenSidebarLegend()).toBe(false)
  })

  it('is seen after marking', () => {
    markSidebarLegendSeen()
    expect(hasSeenSidebarLegend()).toBe(true)
  })

  it('treats a blocked localStorage as already-seen, not never-seen', () => {
    // happy-dom's localStorage is Proxy-backed and doesn't dispatch through
    // Storage.prototype for method lookups, so spy on the instance directly
    // (deviation from the plan's Storage.prototype spy, which is a no-op here).
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    // Must return true (already seen) on a blocked store, matching SalesLegend's
    // hasSeen() fail-safe — never auto-open rather than nag every render.
    expect(hasSeenSidebarLegend()).toBe(true)
  })
})
