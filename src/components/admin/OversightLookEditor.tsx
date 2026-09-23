import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useClassOversightLayoutEditor } from '../../hooks/useClassOversightLayout'
import {
  classicCardLabel,
  moveCard,
  seedClassicBoard,
  seedClassLayout,
  seedSuiteBoard,
  suiteCardLabel,
  type ClassOversightLayout,
  type LayoutAccent,
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
        <p>Drag cards for every user in this class. Save look does not change permissions.</p>
      </div>
      <div className="ov-look-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'classic'} className={tab === 'classic' ? 'active' : ''} onClick={() => setTab('classic')}>
          Classic
        </button>
        <button type="button" role="tab" aria-selected={tab === 'suite'} className={tab === 'suite' ? 'active' : ''} onClick={() => setTab('suite')}>
          Suite
        </button>
      </div>
      <LookBoard
        surface={tab}
        board={board}
        onChange={patchBoard}
      />
      <LookStylePanel
        style={board.style}
        onChange={style => patchBoard({ ...board, style })}
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
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const labelOf = surface === 'classic' ? classicCardLabel : suiteCardLabel

  function onDrop(to: number) {
    if (dragFrom == null) return
    onChange({ ...board, cards: moveCard(board.cards, dragFrom, to) })
    setDragFrom(null)
  }

  return (
    <ul className="ov-look-board">
      {board.cards.map((card, index) => (
        <li
          key={card.id}
          className={`ov-look-card${card.hidden ? ' ov-look-card--hidden' : ''}`}
          draggable
          onDragStart={() => setDragFrom(index)}
          onDragOver={e => e.preventDefault()}
          onDrop={() => onDrop(index)}
        >
          <span className="ov-look-handle" aria-hidden>⋮⋮</span>
          <span className="ov-look-label">{labelOf(card.id)}</span>
          <select
            aria-label={`Width for ${labelOf(card.id)}`}
            value={card.width}
            onChange={e => {
              const width = e.target.value as LayoutWidth
              onChange({
                ...board,
                cards: board.cards.map((c, i) => (i === index ? { ...c, width } : c)),
              })
            }}
          >
            {WIDTHS.map(w => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
          <button
            type="button"
            className="ov-look-eye"
            aria-pressed={!card.hidden}
            title={card.hidden ? 'Show card' : 'Hide card'}
            onClick={() =>
              onChange({
                ...board,
                cards: board.cards.map((c, i) => (i === index ? { ...c, hidden: !c.hidden } : c)),
              })
            }
          >
            {card.hidden ? 'Hidden' : 'Shown'}
          </button>
        </li>
      ))}
    </ul>
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
