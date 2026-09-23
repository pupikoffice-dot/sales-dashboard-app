import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useClassOversightLayoutEditor } from '../../hooks/useClassOversightLayout'
import {
  boardStyleAttrs,
  classicCardLabel,
  flowWidthClass,
  moveCardById,
  seedClassicBoard,
  seedClassLayout,
  seedSuiteBoard,
  setCardHidden,
  suiteCardLabel,
  visibleCards,
  type ClassOversightLayout,
  type LayoutAccent,
  type LayoutCard,
  type LayoutCardStyle,
  type LayoutDensity,
  type LayoutSurface,
  type LayoutWidth,
  type OversightBoard,
  type SuiteKind,
} from '../../lib/oversightClassLayout'
import { upsertClassOversightLayout } from '../../lib/oversightClassLayoutApi'

const WIDTHS: LayoutWidth[] = ['full', 'half', 'third']
const ACCENTS: LayoutAccent[] = ['indigo', 'green', 'amber', 'slate']
const DENSITIES: LayoutDensity[] = ['comfortable', 'compact']
const CARD_STYLES: LayoutCardStyle[] = ['soft', 'solid', 'outline']

export interface OversightLookEditorProps {
  classId: string
  suiteKind: SuiteKind
}

export function OversightLookEditor({ classId, suiteKind }: OversightLookEditorProps) {
  const qc = useQueryClient()
  const savedQ = useClassOversightLayoutEditor(classId)
  const [tab, setTab] = useState<LayoutSurface>('classic')
  const [draft, setDraft] = useState<ClassOversightLayout>(() => seedClassLayout(suiteKind))
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (savedQ.isLoading) return
    setDraft(savedQ.data?.layout ?? seedClassLayout(suiteKind))
  }, [classId, savedQ.data, savedQ.isLoading, suiteKind])

  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(null), 3500)
    return () => window.clearTimeout(t)
  }, [notice])

  const board = tab === 'classic' ? draft.classic : draft.suite

  function patchBoard(next: OversightBoard) {
    setDraft(prev => (tab === 'classic' ? { ...prev, classic: next } : { ...prev, suite: next }))
  }

  function resetOpenTab() {
    patchBoard(tab === 'classic' ? seedClassicBoard() : seedSuiteBoard(suiteKind))
  }

  const saveMut = useMutation({
    mutationFn: () => upsertClassOversightLayout(classId, draft),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['class-oversight-layout-editor', classId] })
      await qc.invalidateQueries({ queryKey: ['class-oversight-layout'] })
      setNotice('Look saved')
    },
  })

  const saveError = saveMut.error instanceof Error ? saveMut.error.message : null

  return (
    <section className="ov-look-editor">
      <div className="ov-look-editor-head">
        <h3>Oversight look</h3>
        <p>Drag the preview cards. This is one company column — the same wrap users will see.</p>
      </div>
      <div className="ov-look-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'classic'} className={tab === 'classic' ? 'active' : ''} onClick={() => setTab('classic')}>
          Classic
        </button>
        <button type="button" role="tab" aria-selected={tab === 'suite'} className={tab === 'suite' ? 'active' : ''} onClick={() => setTab('suite')}>
          Suite
        </button>
      </div>
      <LookStylePanel
        style={board.style}
        onChange={style => patchBoard({ ...board, style })}
      />
      <LookBoard
        surface={tab}
        board={board}
        onChange={patchBoard}
      />
      <div className="ov-look-actions">
        <button type="button" onClick={() => saveMut.mutate()} disabled={saveMut.isPending || savedQ.isLoading}>
          {saveMut.isPending ? 'Saving look…' : 'Save look'}
        </button>
        <button type="button" className="ov-look-reset" onClick={resetOpenTab}>
          Reset
        </button>
        {notice && !saveError ? (
          <p className="perm-mutation-saved" role="status">{notice}</p>
        ) : null}
        {saveError ? (
          <p className="perm-mutation-error" role="alert">{saveError}</p>
        ) : null}
      </div>
    </section>
  )
}

function LookBoard({
  surface,
  board,
  onChange,
}: {
  surface: LayoutSurface
  board: OversightBoard
  onChange: (next: OversightBoard) => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const labelOf = surface === 'classic' ? classicCardLabel : suiteCardLabel
  const shown = visibleCards(board)
  const hidden = board.cards.filter(c => c.hidden)

  function patchCards(cards: LayoutCard[]) {
    onChange({ ...board, cards })
  }

  function onDropOnCard(toId: string) {
    if (!dragId || dragId === toId) return
    let next = setCardHidden(board.cards, dragId, false)
    next = moveCardById(next, dragId, toId)
    patchCards(next)
    setDragId(null)
  }

  function onDropHide() {
    if (!dragId) return
    patchCards(setCardHidden(board.cards, dragId, true))
    setDragId(null)
  }

  function setWidth(id: string, width: LayoutWidth) {
    patchCards(board.cards.map(c => (c.id === id ? { ...c, width } : c)))
  }

  return (
    <div className="ov-look-stage">
      <div
        className="ov-look-canvas ov-col--flow"
        {...boardStyleAttrs(board.style)}
        onDragOver={e => e.preventDefault()}
        onDrop={() => {
          if (!dragId) return
          patchCards(setCardHidden(board.cards, dragId, false))
          setDragId(null)
        }}
      >
        <div className="ov-look-canvas-hdr">Preview — one company column</div>
        {shown.map(card => (
          <div key={card.id} className={flowWidthClass(card.width)}>
            <article
              className={`ov-look-tile ${surface === 'classic' ? 'ov-section' : 'sm-cube'}${dragId === card.id ? ' ov-look-tile--dragging' : ''}`}
              draggable
              onDragStart={() => setDragId(card.id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.stopPropagation()
                onDropOnCard(card.id)
              }}
            >
              <header className="ov-look-tile-bar">
                <span className="ov-look-handle" aria-hidden>⋮⋮</span>
                <span className="ov-look-label">{labelOf(card.id)}</span>
                <select
                  aria-label={`Width for ${labelOf(card.id)}`}
                  value={card.width}
                  onPointerDown={e => e.stopPropagation()}
                  onChange={e => setWidth(card.id, e.target.value as LayoutWidth)}
                >
                  {WIDTHS.map(w => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="ov-look-eye"
                  title="Hide card"
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => patchCards(setCardHidden(board.cards, card.id, true))}
                >
                  Hide
                </button>
              </header>
              <LookTileSketch surface={surface} width={card.width} />
            </article>
          </div>
        ))}
      </div>
      <div
        className="ov-look-hidden"
        onDragOver={e => e.preventDefault()}
        onDrop={onDropHide}
      >
        <h4>Hidden</h4>
        {hidden.length === 0 ? (
          <p>Drop a card here to hide it from users.</p>
        ) : (
          <ul>
            {hidden.map(card => (
              <li
                key={card.id}
                draggable
                onDragStart={() => setDragId(card.id)}
                onDragEnd={() => setDragId(null)}
              >
                <span>{labelOf(card.id)}</span>
                <button
                  type="button"
                  className="ov-look-eye"
                  onClick={() => patchCards(setCardHidden(board.cards, card.id, false))}
                >
                  Show
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function LookTileSketch({ surface, width }: { surface: LayoutSurface; width: LayoutWidth }) {
  if (surface === 'suite') {
    return (
      <div className="ov-look-sketch ov-look-sketch--suite">
        <div className="ov-look-sketch-val">12,480</div>
        <div className="ov-look-sketch-bar" style={{ width: width === 'full' ? '72%' : width === 'half' ? '58%' : '46%' }} />
        <div className="ov-look-sketch-meta">clients · qty</div>
      </div>
    )
  }
  return (
    <div className="ov-look-sketch">
      <div className="ov-look-sketch-kpis">
        <span />
        <span />
        <span />
      </div>
      <div className="ov-look-sketch-rows">
        <i />
        <i />
        <i />
      </div>
    </div>
  )
}

function LookStylePanel({
  style,
  onChange,
}: {
  style: OversightBoard['style']
  onChange: (style: OversightBoard['style']) => void
}) {
  const knobs = useMemo(
    () =>
      [
        { key: 'accent' as const, label: 'Accent', options: ACCENTS },
        { key: 'density' as const, label: 'Density', options: DENSITIES },
        { key: 'cardStyle' as const, label: 'Card style', options: CARD_STYLES },
      ] as const,
    [],
  )

  return (
    <div className="ov-look-style">
      {knobs.map(knob => (
        <label key={knob.key}>
          <span>{knob.label}</span>
          <select
            value={style[knob.key]}
            onChange={e => onChange({ ...style, [knob.key]: e.target.value })}
          >
            {knob.options.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </label>
      ))}
    </div>
  )
}
