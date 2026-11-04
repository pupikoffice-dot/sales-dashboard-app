/** Small pieces shared by the R&D reports that show gross margin. */
import { useLocale } from '../../context/LocaleContext'
import { coveragePercent } from '../../lib/grossMargin'
import { fmt0 } from '../../lib/format'

export const moneyOrDash = (v: number | null | undefined) => (v == null ? '—' : fmt0(v))

/** "Margin covers 93% of net sales" under a table or tile group; says so when no item had a cost. Hidden without margin data. */
export function MarginNote({ visible, coverage, className = 'sel-months-list' }: { visible: boolean; coverage: number | null; className?: string }) {
  const { t } = useLocale()
  if (!visible) return null
  const pct = coveragePercent(coverage)
  return (
    <p className={className} style={{ margin: '0 0 8px' }} title={t('gm.hint')}>
      {pct == null ? t('gm.coverageNone') : t('gm.coverage', { pct })}
    </p>
  )
}
