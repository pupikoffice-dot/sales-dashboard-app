import { useState, type ReactNode } from 'react'
import { useSalesReportUi } from '../../context/SalesReportUiContext'
import { fmt } from '../../lib/format'

interface SalesSectionProps {
  icon: string
  title: ReactNode
  exportName: string
  exportId: string
  cash: number
  qty: number
  stockQty?: number | null
  children: ReactNode
}

export function SalesSection({
  icon,
  title,
  exportName,
  exportId,
  cash,
  qty,
  stockQty,
  children,
}: SalesSectionProps) {
  const { globalCollapsed, clearGlobalCollapse } = useSalesReportUi()
  const [localCollapsed, setLocalCollapsed] = useState(false)
  const collapsed = globalCollapsed ?? localCollapsed

  function handleTitleClick() {
    clearGlobalCollapse()
    setLocalCollapsed(c => !c)
  }

  return (
    <div
      className={`section${collapsed ? ' collapsed' : ''}`}
      data-export-name={exportName}
      data-export-id={exportId}
    >
      <div
        className="section-title"
        onClick={handleTitleClick}
        onKeyDown={e => e.key === 'Enter' && handleTitleClick()}
        role="button"
        tabIndex={0}
      >
        {icon} {title}
        {stockQty != null && (
          <span className="section-stock">· Stock: {fmt(stockQty)}</span>
        )}
        <span className="collapse-icon">▾</span>
      </div>
      <div className="section-sum">
        <span>
          Cash: <b>{fmt(cash)}</b>
        </span>
        <span>
          Qty: <b>{fmt(qty)}</b>
        </span>
        {stockQty != null && (
          <span>
            Stock: <b className="accent2">{fmt(stockQty)}</b>
          </span>
        )}
      </div>
      <div className="section-body">{children}</div>
    </div>
  )
}
