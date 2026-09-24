import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

const MAX_UNDO = 40

function cloneBoard(board: OversightBoard): OversightBoard {
  return {
    style: { ...board.style },
    cards: board.cards.map(c => ({ ...c })),
  }
}

function cloneLayout(layout: ClassOversightLayout): ClassOversightLayout {
  return {
    classic: cloneBoard(layout.classic),
    suite: cloneBoard(layout.suite),
  }
}

export interface PatchBoardOptions {
  /** When true, do not push the previous board onto the undo stack (e.g. mid-resize). */
  skipHistory?: boolean
}

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
  canUndo: boolean
  start: () => void
  cancel: () => void
  resetOpen: () => void
  undo: () => void
  /** Snapshot the open board before a multi-step gesture (e.g. mouse resize). */
  checkpoint: () => void
  save: () => void
  patchActiveBoard: (next: OversightBoard, opts?: PatchBoardOptions) => void
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
  const [undoStack, setUndoStack] = useState<OversightBoard[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const draftRef = useRef<ClassOversightLayout | null>(null)

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

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
      setUndoStack([])
    }
  }, [arranging, canStart])

  const pushUndo = useCallback((board: OversightBoard) => {
    setUndoStack(prev => [...prev.slice(-(MAX_UNDO - 1)), cloneBoard(board)])
  }, [])

  const checkpoint = useCallback(() => {
    const current = draftRef.current
    if (!current) return
    const board = surface === 'classic' ? current.classic : current.suite
    pushUndo(board)
  }, [pushUndo, surface])

  const start = useCallback(() => {
    if (!canStart) return
    const base = savedLayout ?? seedClassLayout(suiteKind)
    setDraft(cloneLayout(base))
    setUndoStack([])
    setArranging(true)
    setNotice(null)
  }, [canStart, savedLayout, suiteKind])

  const cancel = useCallback(() => {
    setArranging(false)
    setDraft(null)
    setUndoStack([])
    setNotice(null)
  }, [])

  const resetOpen = useCallback(() => {
    setDraft(prev => {
      if (!prev) return prev
      const open = surface === 'classic' ? prev.classic : prev.suite
      pushUndo(open)
      if (surface === 'classic') return { ...prev, classic: seedClassicBoard() }
      return { ...prev, suite: seedSuiteBoard(suiteKind) }
    })
  }, [pushUndo, surface, suiteKind])

  const undo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev
      const restored = prev[prev.length - 1]!
      setDraft(d => {
        if (!d) return d
        return surface === 'classic'
          ? { ...d, classic: cloneBoard(restored) }
          : { ...d, suite: cloneBoard(restored) }
      })
      return prev.slice(0, -1)
    })
  }, [surface])

  const patchActiveBoard = useCallback(
    (next: OversightBoard, opts?: PatchBoardOptions) => {
      setDraft(prev => {
        if (!prev) return prev
        if (!opts?.skipHistory) {
          const open = surface === 'classic' ? prev.classic : prev.suite
          pushUndo(open)
        }
        return surface === 'classic' ? { ...prev, classic: next } : { ...prev, suite: next }
      })
    },
    [pushUndo, surface],
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
      setUndoStack([])
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
    canUndo: undoStack.length > 0,
    start,
    cancel,
    resetOpen,
    undo,
    checkpoint,
    save: () => saveMut.mutate(),
    patchActiveBoard,
  }
}
