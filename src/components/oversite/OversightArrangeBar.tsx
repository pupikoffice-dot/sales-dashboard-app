import type { ReactNode } from 'react'
import {
  classicCardLabel,
  moveCardById,
  setCardHidden,
  suiteCardLabel,
  type LayoutAccent,
  type LayoutCardStyle,
  type LayoutDensity,
  type LayoutWidth,
} from '../../lib/oversightClassLayout'
import type { OversightArrangeApi } from '../../hooks/useOversightArrange'

const WIDTHS: LayoutWidth[] = ['full', 'half', 'third']
const ACCENTS: LayoutAccent[] = ['indigo', 'green', 'amber', 'slate']
const DENSITIES: LayoutDensity[] = ['comfortable', 'compact']
const CARD_STYLES: LayoutCardStyle[] = ['soft', 'solid', 'outline']

export function OversightArrangeBar({ arrange }: { arrange: OversightArrangeApi }) {
  if (!arrange.canArrange) return null

  if (!arrange.arranging) {
    return (
      <div className="ov-arrange-bar">
        <button
          type="button"
          className="ov-arrange-toggle"
          disabled={!arrange.canStart}
          title={arrange.needsViewAs ? 'View as a user first to edit their class look' : 'Arrange Oversight for this class'}
          onClick={arrange.start}
        >
          Arrange
        </button>
        {arrange.needsViewAs ? (
          <span className="ov-arrange-hint">View as a user to pick a class</span>
        ) : null}
        {arrange.notice ? (
          <span className="perm-mutation-saved" role="status">{arrange.notice}</span>
        ) : null}
      </div>
    )
  }

  const board = arrange.activeBoard
  if (!board) return null

  return (
    <div className="ov-arrange-bar ov-arrange-bar--on">
      <span className="ov-arrange-badge">Arranging</span>
      <label className="ov-arrange-style">
        <span>Accent</span>
        <select
          value={board.style.accent}
          onChange={e =>
            arrange.patchActiveBoard({
              ...board,
              style: { ...board.style, accent: e.target.value as LayoutAccent },
            })
          }
        >
          {ACCENTS.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </label>
      <label className="ov-arrange-style">
        <span>Density</span>
        <select
          value={board.style.density}
          onChange={e =>
            arrange.patchActiveBoard({
              ...board,
              style: { ...board.style, density: e.target.value as LayoutDensity },
            })
          }
        >
          {DENSITIES.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </label>
      <label className="ov-arrange-style">
        <span>Card</span>
        <select
          value={board.style.cardStyle}
          onChange={e =>
            arrange.patchActiveBoard({
              ...board,
              style: { ...board.style, cardStyle: e.target.value as LayoutCardStyle },
            })
          }
        >
          {CARD_STYLES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>
      <button type="button" onClick={arrange.save} disabled={arrange.isSaving}>
        {arrange.isSaving ? 'Saving…' : 'Save'}
      </button>
      <button type="button" className="ov-arrange-reset" onClick={arrange.resetOpen}>
        Reset
      </button>
      <button type="button" className="ov-arrange-cancel" onClick={arrange.cancel}>
        Cancel
      </button>
      {arrange.error ? (
        <span className="perm-mutation-error" role="alert">{arrange.error}</span>
      ) : null}
    </div>
  )
}

export function ArrangeCardChrome({
  arrange,
  cardId,
  children,
}: {
  arrange: OversightArrangeApi
  cardId: string
  children: ReactNode
}) {
  if (!arrange.arranging || !arrange.activeBoard) return <>{children}</>
  const board = arrange.activeBoard
  const card = board.cards.find(c => c.id === cardId)
  if (!card || card.hidden) return null

  return (
    <div
      className="ov-arrange-card"
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('text/ov-card-id', cardId)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        e.preventDefault()
        const fromId = e.dataTransfer.getData('text/ov-card-id')
        if (!fromId || fromId === cardId) return
        arrange.patchActiveBoard({
          ...board,
          cards: moveCardById(board.cards, fromId, cardId),
        })
      }}
    >
      <div className="ov-arrange-card-bar">
        <span className="ov-look-handle" aria-hidden>⋮⋮</span>
        <select
          aria-label="Card width"
          value={card.width}
          onPointerDown={e => e.stopPropagation()}
          onChange={e =>
            arrange.patchActiveBoard({
              ...board,
              cards: board.cards.map(c =>
                c.id === cardId ? { ...c, width: e.target.value as LayoutWidth } : c,
              ),
            })
          }
        >
          {WIDTHS.map(w => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
        <button
          type="button"
          className="ov-look-eye"
          onPointerDown={e => e.stopPropagation()}
          onClick={() =>
            arrange.patchActiveBoard({
              ...board,
              cards: setCardHidden(board.cards, cardId, true),
            })
          }
        >
          Hide
        </button>
      </div>
      {children}
    </div>
  )
}

export function ArrangeHiddenTray({
  arrange,
  surface,
}: {
  arrange: OversightArrangeApi
  surface: 'classic' | 'suite'
}) {
  if (!arrange.arranging || !arrange.activeBoard) return null
  const board = arrange.activeBoard
  const hidden = board.cards.filter(c => c.hidden)
  const labelOf = surface === 'classic' ? classicCardLabel : suiteCardLabel
  return (
    <div
      className="ov-arrange-hidden"
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        e.preventDefault()
        const fromId = e.dataTransfer.getData('text/ov-card-id')
        if (!fromId) return
        arrange.patchActiveBoard({
          ...board,
          cards: setCardHidden(board.cards, fromId, true),
        })
      }}
    >
      <h4>Hidden</h4>
      {hidden.length === 0 ? (
        <p>Drop a card here to hide it</p>
      ) : (
        <ul>
          {hidden.map(card => (
            <li key={card.id}>
              <span>{labelOf(card.id)}</span>
              <button
                type="button"
                className="ov-look-eye"
                onClick={() =>
                  arrange.patchActiveBoard({
                    ...board,
                    cards: setCardHidden(board.cards, card.id, false),
                  })
                }
              >
                Show
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
