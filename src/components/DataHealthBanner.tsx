import { Link } from 'react-router-dom'
import { useDashboardAccess } from '../context/DashboardAccessContext'
import { useLocale } from '../context/LocaleContext'
import { useDataHealthNotices, useDataHealthSendState } from '../hooks/useDataHealth'
import { itemsForUser, monitorStale, oldestUpdate, summarise, unacknowledgedRed } from '../lib/dataHealth/notices'

const BAR = { margin: '0 0 12px', fontSize: 14 } as const
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '-')

/**
 * In-app data-freshness alert (2026-10-29), shown at the top of every page.
 * - Admins and super admins: a red bar listing every late source with a link to Admin -> Data health, a warning when the
 *   monitor itself stopped, and a note when alert emails cannot be delivered.
 * - Everyone else: a short notice when a sales/orders/deliveries source of his own companies is late.
 */
export function DataHealthBanner({ canManage }: { canManage: boolean }) {
  const { t } = useLocale()
  const { access } = useDashboardAccess()
  const notices = useDataHealthNotices()
  const send = useDataHealthSendState(canManage)
  if (!notices.data) return null

  const { items, last_run_at } = notices.data
  if (canManage) {
    const red = unacknowledgedRed(items)
    const stale = monitorStale(last_run_at, new Date())
    const emailError = send.data?.last_send_error
    return (
      <>
        {red.length > 0 && (
          <div className="status-msg error" style={BAR} role="alert">
            <b>{t('dh.adminBar')}</b> {summarise(red)} · {t('dh.lastUpdated')} {fmt(oldestUpdate(red))}{' '}
            <Link to="/admin/data-health" style={{ fontWeight: 600, textDecoration: 'underline' }}>{t('dh.open')}</Link>
          </div>
        )}
        {stale && (
          <div className="status-msg error" style={BAR} role="alert">
            {last_run_at ? `${t('dh.monitorStale')} ${fmt(last_run_at)}.` : t('dh.monitorNever')}{' '}
            <Link to="/admin/data-health" style={{ textDecoration: 'underline' }}>{t('dh.open')}</Link>
          </div>
        )}
        {emailError && (
          <div className="status-msg" style={{ ...BAR, border: '1px solid #ed8c00' }}>
            {t('dh.emailBroken')} {emailError}
          </div>
        )}
      </>
    )
  }

  const mine = itemsForUser(items, access?.companies ?? [])
  if (!mine.length) return null
  return (
    <div className="status-msg" style={{ ...BAR, border: '1px solid #ed8c00' }} role="status">
      <b>{t('dh.userNotice')}</b> {summarise(mine)} · {t('dh.lastUpdated')} {fmt(oldestUpdate(mine))}
    </div>
  )
}
