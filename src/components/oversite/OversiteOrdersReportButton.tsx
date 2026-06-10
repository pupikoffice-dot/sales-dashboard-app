import { useLocale } from '../../context/LocaleContext'

export function OversiteOrdersReportButton({ onClick }: { onClick: () => void }) {
  const { t } = useLocale()

  return (
    <button type="button" className="ov-debt-btn" style={{ marginTop: 10 }} onClick={onClick}>
      📋 {t('oversite.fullOrdersReport')}
    </button>
  )
}
