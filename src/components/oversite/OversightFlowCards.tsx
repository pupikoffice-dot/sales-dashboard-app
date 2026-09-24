import type { ReactNode } from 'react'
import { flowCardStyle, visibleCards, type OversightBoard } from '../../lib/oversightClassLayout'

/** Place saved-board cards on the 12-column flow. Missing/denied nodes are skipped. */
export function OversightFlowCards({
  board,
  nodes,
  wrapNode,
}: {
  board: OversightBoard
  nodes: Record<string, ReactNode>
  wrapNode?: (id: string, node: ReactNode) => ReactNode
}) {
  return (
    <>
      {visibleCards(board).map(card => {
        const node = nodes[card.id]
        if (!node) return null
        const inner = wrapNode ? wrapNode(card.id, node) : node
        return (
          <div key={card.id} className="ov-flow" style={flowCardStyle(card)}>
            {inner}
          </div>
        )
      })}
    </>
  )
}
