import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { useDashboardAccess } from '../context/DashboardAccessContext'
import { useLocale } from '../context/LocaleContext'
import { usePreview } from '../context/PreviewContext'
import { useIntercompanyIdentities } from '../hooks/useIntercompanyIdentities'
import { setActiveIntercompanyIdentity, type IntercompanyIdentity } from '../lib/intercompanyApi'
import { companyLabel } from '../lib/salesMetrics'

function identityLabel(identity: IntercompanyIdentity): string {
  const companies = identity.companies.map(companyLabel).join(' / ')
  const agent = identity.agentErpId ?? identity.username
  if (companies && agent) return `${companies} · ${agent}`
  return companies || identity.name || agent || '—'
}

/**
 * Top-bar switch for someone who holds two ERP agent identities in two
 * companies. Renders nothing unless a super admin has linked the accounts, so
 * it is invisible to everyone else.
 *
 * The active identity is server state: switching calls an RPC that validates
 * the link, after which get_dashboard_access serves the linked account's
 * scope. That means cached rows were fetched under the previous identity and
 * have to be dropped here.
 */
export function IntercompanySwitcher() {
  const { session } = useAuth()
  const { isPreviewing } = usePreview()
  const { t } = useLocale()
  const { refresh } = useDashboardAccess()
  const queryClient = useQueryClient()
  const [switching, setSwitching] = useState(false)

  // Hidden while previewing: the switch acts on the real session, not on the
  // account being previewed, which would be ambiguous.
  const { data: identities } = useIntercompanyIdentities(
    isPreviewing ? null : session?.user.id,
  )

  const options = identities ?? []
  if (options.length < 2) return null

  async function select(target: IntercompanyIdentity) {
    if (target.isActive || switching) return
    setSwitching(true)
    try {
      await setActiveIntercompanyIdentity(target.isSelf ? null : target.userId)
      // Keep the switcher's own query so the control stays mounted; everything
      // else was scoped to the identity we just left.
      queryClient.removeQueries({
        predicate: q => q.queryKey[0] !== 'intercompany-identities',
      })
      await queryClient.invalidateQueries({ queryKey: ['intercompany-identities'] })
      await refresh()
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div className="ic-switch" role="group" aria-label={t('intercompany.switchLabel')}>
      {options.map(option => (
        <button
          key={option.userId}
          type="button"
          className={`ic-btn${option.isActive ? ' active' : ''}`}
          aria-pressed={option.isActive}
          disabled={switching}
          title={t('intercompany.switchTo', { identity: identityLabel(option) })}
          onClick={() => select(option)}
        >
          {identityLabel(option)}
        </button>
      ))}
    </div>
  )
}
