import { describe, expect, it } from 'vitest'
import {
  BETA_PRODUCT_VERSION,
  LEGACY_PRODUCT_VERSION,
  formatHeaderVersionBadge,
  resolveAppChannel,
} from './appChannel'

describe('resolveAppChannel', () => {
  it('detects the beta alias host', () => {
    expect(resolveAppChannel('pupik-sales-dashboard-beta.vercel.app')).toBe('beta')
  })

  it('detects the legacy alias host', () => {
    expect(resolveAppChannel('pupik-sales-dashboard-legacy.vercel.app')).toBe('legacy')
  })

  it('detects production host', () => {
    expect(resolveAppChannel('sales-dashboard-app-omega.vercel.app')).toBe('production')
  })

  it('detects production git-main preview host', () => {
    expect(resolveAppChannel('sales-dashboard-app-git-main-pupikoffice-dots-projects.vercel.app')).toBe(
      'production',
    )
  })

  it('treats localhost as beta', () => {
    expect(resolveAppChannel('localhost')).toBe('beta')
  })
})

describe('formatHeaderVersionBadge', () => {
  it('shows live DB version on production', () => {
    expect(formatHeaderVersionBadge('2.0', 'production')).toBe('2.0')
  })

  it('shows product version + beta on beta channel', () => {
    expect(formatHeaderVersionBadge('2.0', 'beta')).toBe(`${BETA_PRODUCT_VERSION} · beta`)
  })

  it('shows frozen legacy version regardless of DB', () => {
    expect(formatHeaderVersionBadge('2.0', 'legacy')).toBe(`${LEGACY_PRODUCT_VERSION} · legacy`)
  })
})
