import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useArrangeTargetClassId, useSignedInProfileRole } from './useCanArrangeOversight'
import { useClassOversightLayout } from './useClassOversightLayout'
import {
  seedClassicBoard,
  seedClassLayout,
  seedSuiteBoard,
  type ClassOversightLayout,
  type LayoutSurface,
  type OversightBoard,
  type SuiteKind,
} from '../lib/oversightClassLayout'
import { upsertClassOversightLayout } from '../lib/oversightClassLayoutApi'

export interface OversightArrangeApi {
  canArrange: boolean
  arranging: boolean
  canStart: boolean
  needsViewAs: boolean
  classId: string | null
  suiteKind: SuiteKind
  surface: LayoutSurface
  draft: ClassOversightLayout | null
  activeBoard: OversightBoard | null
  /** Board to render: draft while arranging, else saved (null = today's layout). */
  displayBoard: OversightBoard | null
  notice: string | null
  error: string | null
  isSaving: boolean
  start: () => void
  cancel: () => void
  resetOpen: () => void
  save: () => void
  patchActiveBoard: (next: OversightBoard) => void
}

export function useOversightArrange(surface: LayoutSurface): OversightArrangeApi {
  const { canArrange, isSuperAdmin } = useSignedInProfileRole()
  const targetClassQ = useArrangeTargetClassId()
  const layoutQ = useClassOversightLayout()
  const qc = useQueryClient()

  const classId = targetClassQ.data ?? null
  const needsViewAs = canArrange && isSuperAdmin && !classId
  const canStart = canArrange && !!classId

  const suiteKind: SuiteKind = layoutQ.data?.suiteKind ?? 'manager'
  const savedLayout = layoutQ.data?.layout ?? null
  const hasSavedRow = layoutQ.data?.hasSavedRow === true

  const [arranging, setArranging] = useState(false)
  const [draft, setDraft] = useState<ClassOversightLayout | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(null), 3500)
    return () => window.clearTimeout(t)
  }, [notice])

  useEffect(() => {
    if (!arranging) return
    if (!canStart) {
      setArranging(false)
      setDraft(null)
    }
  }, [arranging, canStart])

  const start = useCallback(() => {
    if (!canStart) return
    const base = savedLayout ?? seedClassLayout(suiteKind)
    setDraft({
      classic: { cards: base.classic.cards.map(c => ({ ...c })), style: { ...base.classic.style } },
      suite: { cards: base.suite.cards.map(c => ({ ...c })), style: { ...base.suite.style } },
    })
    setArranging(true)
    setNotice(null)
  }, [canStart, savedLayout, suiteKind])

  const cancel = useCallback(() => {
    setArranging(false)
    setDraft(null)
    setNotice(null)
  }, [])

  const resetOpen = useCallback(() => {
    setDraft(prev => {
      if (!prev) return prev
      if (surface === 'classic') return { ...prev, classic: seedClassicBoard() }
      return { ...prev, suite: seedSuiteBoard(suiteKind) }
    })
  }, [surface, suiteKind])

  const patchActiveBoard = useCallback(
    (next: OversightBoard) => {
      setDraft(prev => {
        if (!prev) return prev
        return surface === 'classic' ? { ...prev, classic: next } : { ...prev, suite: next }
      })
    },
    [surface],
  )

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!classId || !draft) throw new Error('Nothing to save')
      await upsertClassOversightLayout(classId, draft)
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['class-oversight-layout'] })
      await qc.invalidateQueries({ queryKey: ['class-oversight-layout-editor'] })
      setArranging(false)
      setDraft(null)
      setNotice('Look saved')
    },
  })

  const activeBoard = arranging && draft ? (surface === 'classic' ? draft.classic : draft.suite) : null

  const displayBoard = useMemo(() => {
    if (arranging && draft) return surface === 'classic' ? draft.classic : draft.suite
    if (hasSavedRow && savedLayout) return surface === 'classic' ? savedLayout.classic : savedLayout.suite
    return null
  }, [arranging, draft, hasSavedRow, savedLayout, surface])

  return {
    canArrange,
    arranging,
    canStart,
    needsViewAs,
    classId,
    suiteKind,
    surface,
    draft,
    activeBoard,
    displayBoard,
    notice,
    error: saveMut.error instanceof Error ? saveMut.error.message : null,
    isSaving: saveMut.isPending,
    start,
    cancel,
    resetOpen,
    save: () => saveMut.mutate(),
    patchActiveBoard,
  }
}
