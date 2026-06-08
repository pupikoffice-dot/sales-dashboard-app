import type { CSSProperties, ReactNode } from 'react'

interface SortableThProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  pieCash?: boolean
  pieQty?: boolean
}

/** Sortable header — click handled by useTableSortDelegation (legacy DOM sort). */
export function SortableTh({ children, className, style, pieCash, pieQty }: SortableThProps) {
  return (
    <th
      className={`sortable${className ? ` ${className}` : ''}`}
      style={style}
      {...(pieCash ? { 'data-pie-cash': true } : {})}
      {...(pieQty ? { 'data-pie-qty': true } : {})}
    >
      {children}
      <span className="si"> ↕</span>
    </th>
  )
}
