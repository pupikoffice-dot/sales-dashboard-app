import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import {
  cardCols,
  cardHeightPx,
  classicCardLabel,
  clampCols,
  clampHeightPx,
  MAX_CARD_COLS,
  moveCardById,
  setCardHidden,
  setCardSize,
  suiteCardLabel,
  WIDTH_COLS,
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
      <span className="ov-arrange-hint">Drag ⋮⋮ to move · edges to resize</span>
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

type ResizeAxis = 'x' | 'y' | 'xy'

export function ArrangeCardChrome({
  arrange,
  cardId,
  children,
}: {
  arrange: OversightArrangeApi
  cardId: string
  children: ReactNode
}) {
  const shellRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef(arrange.activeBoard)
  useEffect(() => {
    boardRef.current = arrange.activeBoard
  }, [arrange.activeBoard])

  if (!arrange.arranging || !arrange.activeBoard) return <>{children}</>
  const board = arrange.activeBoard
  const card = board.cards.find(c => c.id === cardId)
  if (!card || card.hidden) return null

  const cols = cardCols(card)
  const heightPx = cardHeightPx(card)

  function patchSize(next: { cols?: number; heightPx?: number | null }) {
    const current = boardRef.current
    if (!current) return
    const updated = {
      ...current,
      cards: setCardSize(current.cards, cardId, next),
    }
    boardRef.current = updated
    arrange.patchActiveBoard(updated)
  }

  function startResize(axis: ResizeAxis, e: ReactPointerEvent<HTMLButtonElement>) {
    e.preventDefault()
    e.stopPropagation()
    const shell = shellRef.current
    if (!shell) return
    const grid = shell.closest('.ov-col--flow, .sm-cube-grid--flow, .sm-vs-grid--flow') as HTMLElement | null
    const gridWidth = grid?.clientWidth || shell.parentElement?.clientWidth || 1
    const colUnit = gridWidth / 12
    const startX = e.clientX
    const startY = e.clientY
    const startCols = cols
    const startHeight = heightPx ?? shell.offsetHeight

    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)

    function onMove(ev: PointerEvent) {
      const patch: { cols?: number; heightPx?: number | null } = {}
      if (axis === 'x' || axis === 'xy') {
        patch.cols = clampCols(startCols + (ev.clientX - startX) / colUnit)
      }
      if (axis === 'y' || axis === 'xy') {
        patch.heightPx = clampHeightPx(startHeight + (ev.clientY - startY))
      }
      patchSize(patch)
    }

    function onUp(ev: PointerEvent) {
      target.releasePointerCapture(ev.pointerId)
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
    }

    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }

  return (
    <div
      ref={shellRef}
      className="ov-arrange-card"
      style={heightPx != null ? { minHeight: heightPx } : undefined}
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        e.preventDefault()
        const fromId = e.dataTransfer.getData('text/ov-card-id')
        if (!fromId || fromId === cardId) return
        const current = boardRef.current
        if (!current) return
        arrange.patchActiveBoard({
          ...current,
          cards: moveCardById(current.cards, fromId, cardId),
        })
      }}
    >
      <div className="ov-arrange-card-bar">
        <span
          className="ov-look-handle"
          draggable
          title="Drag to reorder"
          onDragStart={e => {
            e.dataTransfer.setData('text/ov-card-id', cardId)
            e.dataTransfer.effectAllowed = 'move'
          }}
          aria-hidden
        >
          ⋮⋮
        </span>
        <span className="ov-arrange-size-lbl">
          {cols}/{MAX_CARD_COLS}
          {heightPx != null ? ` · ${heightPx}px` : ''}
        </span>
        <select
          aria-label="Card width snap"
          value={card.width}
          onPointerDown={e => e.stopPropagation()}
          onChange={e => {
            const width = e.target.value as LayoutWidth
            patchSize({ cols: WIDTH_COLS[width] })
          }}
        >
          {WIDTHS.map(w => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
        <button
          type="button"
          className="ov-look-eye"
          onPointerDown={e => e.stopPropagation()}
          onClick={() => {
            const current = boardRef.current
            if (!current) return
            arrange.patchActiveBoard({
              ...current,
              cards: setCardHidden(current.cards, cardId, true),
            })
          }}
        >
          Hide
        </button>
        {heightPx != null ? (
          <button
            type="button"
            className="ov-look-eye"
            title="Clear fixed height"
            onPointerDown={e => e.stopPropagation()}
            onClick={() => patchSize({ heightPx: null })}
          >
            Auto H
          </button>
        ) : null}
      </div>
      <div className="ov-arrange-card-body">{children}</div>
      <button
        type="button"
        className="ov-resize-handle ov-resize-handle--e"
        aria-label="Resize width"
        onPointerDown={e => startResize('x', e)}
      />
      <button
        type="button"
        className="ov-resize-handle ov-resize-handle--s"
        aria-label="Resize height"
        onPointerDown={e => startResize('y', e)}
      />
      <button
        type="button"
        className="ov-resize-handle ov-resize-handle--se"
        aria-label="Resize width and height"
        onPointerDown={e => startResize('xy', e)}
      />
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
