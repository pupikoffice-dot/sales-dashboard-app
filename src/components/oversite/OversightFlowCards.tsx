import type { ReactNode } from 'react'
import { flowWidthClass, visibleCards, type OversightBoard } from '../../lib/oversightClassLayout'

/** Place saved-board cards on the 12-column flow. Missing/denied nodes are skipped. */
export function OversightFlowCards({
  board,
  nodes,
}: {
  board: OversightBoard
  nodes: Record<string, ReactNode>
}) {
  return (
    <>
      {visibleCards(board).map(card => {
        const node = nodes[card.id]
        if (!node) return null
        return (
          <div key={card.id} className={flowWidthClass(card.width)}>
            {node}
          </div>
        )
      })}
    </>
  )
}
