import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteClass, fetchClassGrants, fetchClassUserCounts, fetchClasses,
  fetchUsersInClass, insertGrants, deleteGrantsByIds, listKnownAgents, upsertClass,
} from '../../lib/permissionsApi'
import { diffClassGrants, normalizeClassAgentScope, ALL_AGENTS_ITEM_KEY } from '../../lib/classPermissions'
import { countOversightSuiteItemKeys } from '../../lib/uiModules'
import { PermissionSections } from '../../components/admin/PermissionSections'
import { useUiModuleCatalog } from '../../hooks/useUiModules'
import { isClassGrantableUiModule } from '../../lib/suiteUiModules'
import type { AppClass } from '../../types/permissions'

function itemKeyOf(kind: string, key: string, value: string | null) {
  return `${kind}:${key}:${value ?? ''}`
}

const MULTI_SUITE_ERROR = 'A class can have at most one Oversight suite.'

export function ClassesPage() {
  const qc = useQueryClient()
  const { data: classes = [] } = useQuery({ queryKey: ['classes'], queryFn: fetchClasses })
  const { data: userCounts = {} } = useQuery({ queryKey: ['class-user-counts'], queryFn: fetchClassUserCounts })
  const { data: knownAgents = [] } = useQuery({ queryKey: ['known-agents'], queryFn: listKnownAgents })
  const { data: uiModuleCatalog = [] } = useUiModuleCatalog()
  const activeUiModules = uiModuleCatalog.filter(isClassGrantableUiModule)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ id: string; label: string; description: string } | null>(null)
  const [desiredChecked, setDesiredChecked] = useState<Set<string>>(new Set())
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const { data: currentGrants = [] } = useQuery({
    queryKey: ['class-grants', selectedId],
    queryFn: () => fetchClassGrants(selectedId!),
    enabled: !!selectedId,
  })

  useEffect(() => {
    if (!saveNotice) return
    const t = window.setTimeout(() => setSaveNotice(null), 3500)
    return () => window.clearTimeout(t)
  }, [saveNotice])

  function clearSaveNotice() {
    setSaveNotice(null)
  }

  function selectClass(cls: AppClass) {
    clearDraftErrors()
    setSelectedId(cls.id)
    setDraft({ id: cls.id, label: cls.label, description: cls.description ?? '' })
    fetchClassGrants(cls.id).then(grants =>
      setDesiredChecked(
        normalizeClassAgentScope(new Set(grants.map(g => itemKeyOf(g.kind, g.key, g.value)))),
      ),
    )
  }

  function newClass() {
    clearDraftErrors()
    const id = `class_${Date.now()}` // slug refined by the admin before first save if desired
    setSelectedId(null)
    setDraft({ id, label: '', description: '' })
    setDesiredChecked(new Set([ALL_AGENTS_ITEM_KEY]))
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft) return
      const desired = normalizeClassAgentScope(desiredChecked)
      await upsertClass({ id: draft.id, label: draft.label, description: draft.description || null })
      const { toInsert, toDelete } = diffClassGrants(currentGrants, desired)
      await insertGrants(toInsert.map(g => ({ classId: draft.id, kind: g.kind, key: g.key, value: g.value, effect: 'allow' as const })))
      await deleteGrantsByIds(toDelete.map(g => g.id))
    },
    onSuccess: () => {
      setValidationError(null)
      qc.invalidateQueries({ queryKey: ['classes'] })
      qc.invalidateQueries({ queryKey: ['class-grants', draft?.id] })
      // A "+ New Class" save has selectedId still null, so the ['class-grants', selectedId] query
      // stayed disabled/empty the whole time -- currentGrants would silently keep reading as []
      // (a stale diff base) for any SECOND save without reselecting, causing already-saved grants
      // to be re-diffed against nothing and re-inserted. Point selectedId at what was just saved so
      // the grants query tracks the right class from here on.
      if (draft && draft.id !== selectedId) setSelectedId(draft.id)
      setSaveNotice('Saved')
    },
  })

  function clearDraftErrors() {
    clearSaveNotice()
    setValidationError(null)
    saveMutation.reset()
  }

  function saveClass() {
    if (!draft) return
    const desired = normalizeClassAgentScope(desiredChecked)
    if (countOversightSuiteItemKeys(desired) > 1) {
      setValidationError(MULTI_SUITE_ERROR)
      return
    }
    setValidationError(null)
    saveMutation.mutate()
  }

  const deleteMutation = useMutation({
    mutationFn: async (classId: string): Promise<{ deleted: boolean }> => {
      const users = await fetchUsersInClass(classId)
      if (users.length > 0) {
        const names = users.map(u => u.name).join(', ')
        if (!window.confirm(`${users.length} user(s) are assigned to this class: ${names}. Delete anyway?`)) {
          return { deleted: false } // cancelled -- onSuccess must not clear editor state as if it worked
        }
      }
      await deleteClass(classId)
      return { deleted: true }
    },
    onSuccess: (result) => {
      if (!result.deleted) return // cancelled confirm; nothing changed, leave the editor as-is
      clearSaveNotice()
      setValidationError(null)
      qc.invalidateQueries({ queryKey: ['classes'] })
      setSelectedId(null)
      setDraft(null)
    },
  })
  // Every Supabase call in permissionsApi.ts throws on error, but neither mutation defined onError
  // -- without it, a failed save/delete just goes back to idle with no signal, and an admin could
  // believe a permission change was saved when it silently wasn't (RLS rejection, network drop,
  // constraint violation). Surfacing the message inline is the minimum bar for a tool that edits
  // access control.
  const saveError = saveMutation.error instanceof Error ? saveMutation.error.message : null
  const deleteError = deleteMutation.error instanceof Error ? deleteMutation.error.message : null
  const displayError = validationError ?? saveError ?? deleteError

  return (
    <div className="classes-page">
      <aside className="classes-list">
        <button type="button" onClick={newClass}>+ New Class</button>
        {classes.map(c => (
          <button
            key={c.id}
            type="button"
            className={c.id === selectedId ? 'classes-list-item active' : 'classes-list-item'}
            onClick={() => selectClass(c)}
          >
            <strong>{c.label}</strong>
            <span>{userCounts[c.id] ?? 0} users</span>
          </button>
        ))}
      </aside>
      {draft && (
        <section className="class-editor">
          <input
            value={draft.label}
            placeholder="Class name"
            onChange={e => {
              clearDraftErrors()
              setDraft({ ...draft, label: e.target.value })
            }}
          />
          <textarea
            value={draft.description}
            placeholder="Description"
            onChange={e => {
              clearDraftErrors()
              setDraft({ ...draft, description: e.target.value })
            }}
          />
          <PermissionSections
            mode="define"
            desiredChecked={desiredChecked}
            onChange={next => {
              clearDraftErrors()
              setDesiredChecked(next)
            }}
            knownAgents={knownAgents}
            uiModules={activeUiModules}
          />
          <div className="class-editor-actions">
            <button type="button" onClick={saveClass} disabled={!draft.label || saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </button>
            {selectedId && (
              <button type="button" onClick={() => deleteMutation.mutate(selectedId)} disabled={deleteMutation.isPending}>
                Delete
              </button>
            )}
            {saveNotice && !displayError && (
              <p className="perm-mutation-saved" role="status" aria-live="polite">
                {saveNotice}
              </p>
            )}
            {displayError && (
              <p className="perm-mutation-error" role="alert">
                {displayError}
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
