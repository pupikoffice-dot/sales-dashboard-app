import { useLocale } from '../../../context/LocaleContext'
import { fmt } from '../../../lib/format'
import { isOpenBudgetLow } from '../../../lib/tsometBudget'

export interface SmTsometOpenBudgetCubeProps {
  openBudget: number
  budgetCash: number
  isLoading?: boolean
  /** Vs grid uses a distinct grid-area class. */
  variant?: 'alone' | 'vs'
}

/** KPI cube — total Tsomet open budget (budget − orders MTD) for the current agent window. */
export function SmTsometOpenBudgetCube({
  openBudget,
  budgetCash,
  isLoading = false,
  variant = 'alone',
}: SmTsometOpenBudgetCubeProps) {
  const { t } = useLocale()
  const low = !isLoading && isOpenBudgetLow({ budgetCash, openBudget })
  const areaClass = variant === 'vs' ? 'sm-cube--vs-tsomet' : 'sm-cube--tsomet'

  return (
    <div className={`sm-cube ${areaClass}`}>
      <div className="sm-cube-title">{t('sm.cube.tsometOpenBudget')}</div>
      {isLoading ? (
        <div className="sm-cube-val">—</div>
      ) : (
        <div className={`sm-cube-val grn${low ? ' bi-tsomet-open--low' : ''}`}>{fmt(openBudget)}</div>
      )}
    </div>
  )
}
