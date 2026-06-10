import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { useLocale } from '../../context/LocaleContext'
import { canShowModule } from '../../lib/permissions'
import { pathForModule } from '../../modules/registry'

export function OversiteOrdersReportButton() {
  const navigate = useNavigate()
  const { t } = useLocale()
  const { access } = useDashboardAccess()
  const { isSuperAdmin } = useAuth()

  if (!access || !canShowModule(access, 'orders_mtd', isSuperAdmin)) return null

  return (
    <button
      type="button"
      className="ov-debt-btn"
      style={{ marginTop: 10 }}
      onClick={() => navigate(pathForModule('orders_mtd'))}
    >
      📋 {t('oversite.fullOrdersReport')}
    </button>
  )
}
