import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import {
  deleteGrantsByIds, fetchClassGrants, fetchClasses, fetchUserGrants,
  insertGrants, listKnownAgents, setUserClass,
} from '../../lib/permissionsApi'
import { clearOverridesForClassSwitch, diffUserOverrides } from '../../lib/classPermissions'
import { FIELDS, OVERSITE_WIDGETS, PermissionSections, VIEWS } from '../../components/admin/PermissionSections'
import { ExplainAccessPopover, type ExplainItem } from '../../components/admin/ExplainAccessPopover'
import type { GrantKind } from '../../types/permissions'

// explain_access(userId, kind, key) has NO value parameter -- for a 'scope' grant, `key` is the
// DIMENSION ('company' or 'agent'), not a specific value. One call for 'company' returns every
// company grant for that user at once (each returned row carries its own `value`), so this section
// is exactly TWO explain items, not one per company/agent literal like the Fields/Pages sections
// (where each field/node genuinely has its own distinct `key`).
// UI modules are class-only (no per-user suite override) — omit from override explain/toggles.
const COMPANY_AGENT_EXPLAIN: ExplainItem[] = [
  { kind: 'scope', key: 'company', label: 'Companies' },
  { kind: 'scope', key: 'agent', label: 'Agents' },
]
const FIELD_EXPLAIN: ExplainItem[] = FIELDS.map(f => ({ kind: 'field' as const, key: f.key, label: f.label }))
const PAGE_EXPLAIN: ExplainItem[] = [
  ...VIEWS.map(v => ({ kind: 'node' as const, key: `view.${v}`, label: v })),
  ...OVERSITE_WIDGETS.map(w => ({ kind: 'node' as const, key: `widget.${w}`, label: w })),
]

export function UserPermissionsEditor({ userId }: { userId: string }) {
  const qc = useQueryClient()
  const { data: classes = [] } = useQuery({ queryKey: ['classes'], queryFn: fetchClasses, staleTime: 5 * 60_000 })
  const { data: knownAgents = [] } = useQuery({ queryKey: ['known-agents'], queryFn: listKnownAgents, staleTime: 5 * 60_000 })

  const { data: currentClassId } = useQuery({
    queryKey: ['user-class', userId],
    queryFn: async () => {
      const { data } = await supabase.from('app_user_class').select('class_id').eq('user_id', userId).maybeSingle()
      return data?.class_id ?? null
    },
  })
  const { data: classGrants = [] } = useQuery({
    queryKey: ['class-grants', currentClassId],
    queryFn: () => fetchClassGrants(currentClassId!),
    enabled: !!currentClassId,
  })
  const { data: userGrants = [] } = useQuery({
    queryKey: ['user-grants', userId],
    queryFn: () => fetchUserGrants(userId),
  })

  const switchClassMutation = useMutation({
    mutationFn: async (newClassId: string) => {
      if (userGrants.length > 0) {
        const summary = userGrants
          .map(g => `${g.key}${g.value ? ` '${g.value}'` : ''}: ${g.effect}`)
          .join(', ')
        const ok = window.confirm(
          `This user has ${userGrants.length} override(s) on top of their current class: ${summary}. ` +
          `Switching classes will remove them. Continue?`,
        )
        if (!ok) return
        const { toDeleteIds } = clearOverridesForClassSwitch(userGrants)
        await deleteGrantsByIds(toDeleteIds)
      }
      await setUserClass(userId, newClassId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-class', userId] })
      qc.invalidateQueries({ queryKey: ['user-grants', userId] })
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      qc.invalidateQueries({ queryKey: ['class-user-counts'] })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async (args: { kind: GrantKind; key: string; value: string | null; nextChecked: boolean }) => {
      // diffUserOverrides derives the existing override from userGrants itself now -- no need to
      // look it up separately here (that duplication is exactly what caused an unused-parameter
      // typecheck failure earlier in this plan's execution; fixed by having the function own the lookup).
      const ops = diffUserOverrides(classGrants, userGrants, args.kind, args.key, args.nextChecked, args.value)
      for (const op of ops) {
        if (op.type === 'insert') {
          await insertGrants([{ userId, kind: op.kind, key: op.key, value: op.value, effect: op.effect }])
        } else {
          await deleteGrantsByIds([op.grantId])
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-grants', userId] }),
  })
  // Same gap as ClassesPage.tsx's mutations: permissionsApi.ts throws on every Supabase error, but
  // without onError a failed class-switch or toggle just goes back to idle with nothing shown -- the
  // admin could believe a permission change took effect when it silently didn't.
  const switchError = switchClassMutation.error instanceof Error ? switchClassMutation.error.message : null
  const toggleError = toggleMutation.error instanceof Error ? toggleMutation.error.message : null

  return (
    <div className="user-permissions-editor">
      <label>
        Class
        <select
          value={currentClassId ?? ''}
          onChange={e => switchClassMutation.mutate(e.target.value)}
        >
          <option value="" disabled>Select a class…</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </label>
      {(switchError || toggleError) && (
        <p className="perm-mutation-error" role="alert">
          {switchError ?? toggleError}
        </p>
      )}
      {/* One "why?" per section, each explaining every item in that section -- not embedded inside
          PermissionSections' own <h3> tags, since that component has no per-section slot to inject
          into. Functionally equivalent to the spec's intent (per-section explain), placed just
          above the sections instead of literally inside each header. */}
      <div className="user-permissions-header">
        <span>Overrides on top of the class above</span>
        <ExplainAccessPopover userId={userId} items={COMPANY_AGENT_EXPLAIN} sectionLabel="Companies & Agents" />
        <ExplainAccessPopover userId={userId} items={FIELD_EXPLAIN} sectionLabel="Data Fields" />
        <ExplainAccessPopover userId={userId} items={PAGE_EXPLAIN} sectionLabel="Pages & Widgets" />
      </div>
      <PermissionSections
        mode="override"
        classGrants={classGrants}
        userGrants={userGrants}
        knownAgents={knownAgents}
        onToggle={(kind, key, value, nextChecked) => {
          // toggleMutation.mutationFn reads classGrants/userGrants from this component's closure,
          // not from arguments. A second toggle fired before the first's onSuccess invalidation has
          // landed would compute its diff against the same stale snapshot -- for a re-toggle of the
          // SAME item within one round trip, that can produce a stray leftover row (an insert with
          // no matching delete, or vice versa) that silently resurfaces on the next reload. Ignoring
          // clicks while a toggle is already in flight closes that window; PermissionSections has no
          // per-item disabled state to wire, so this guards at the call site instead.
          if (toggleMutation.isPending) return
          toggleMutation.mutate({ kind, key, value, nextChecked })
        }}
      />
    </div>
  )
}
