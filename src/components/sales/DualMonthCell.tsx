import { fmt0 } from '../../lib/format'

interface DualMonthCellProps {
  curCash: number
  curQty: number
  prevCash: number
  prevQty: number
}

export function DualMonthCell({ curCash, curQty, prevCash, prevQty }: DualMonthCellProps) {
  const curStyle = curCash < prevCash ? 'month-worse' : undefined
  const prevStyle = prevCash < curCash ? 'month-worse' : undefined

  return (
    <td
      data-sv={curCash}
      data-cash-cur={curCash}
      data-qty-cur={curQty}
      data-cash-prev={prevCash}
      data-qty-prev={prevQty}
    >
      <div className={curStyle}>
        {fmt0(curCash)}
        <br />
        <span className="cm mo-qty">({fmt0(curQty)})</span>
      </div>
      <div className={`mo-prev${prevStyle ? ` ${prevStyle}` : ''}`}>
        {fmt0(prevCash)}
        <br />
        <span className="cm mo-qty-sm">({fmt0(prevQty)})</span>
      </div>
    </td>
  )
}
