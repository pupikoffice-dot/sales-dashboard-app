import type { AppGrant, GrantKind, PermissionState } from '../../types/permissions'
import { resolveOverrideState } from '../../lib/classPermissions'

// Exported so UserPermissionsEditor (Task 9) can build real per-section explain-access item
// lists without re-declaring these -- one source of truth for what each section contains.
export const COMPANIES = ['pupik', 'mt', 'grow', 'gold'] as const
export const FIELDS: { key: string; label: string; wired: boolean }[] = [
  { key: 'item_cost', label: 'Item cost', wired: true },
  { key: 'client_profit', label: 'Client price', wired: true },
  { key: 'receipts', label: 'Receipts', wired: false }, // see spec: not yet read by get_dashboard_aux
]
export const VIEWS = [
  'oversite', 'sales_performance', 'orders_mtd', 'open_orders',
  'returns', 'debt', 'stock_alerts', 'stock', 'export',
] as const
export const OVERSITE_WIDGETS = [
  'ordersToday', 'ordersMtd', 'openOrders', 'salesMtd', 'topItems',
  'suppliers', 'returns', 'debt', 'receipts', 'stockAlerts',
] as const

interface DefineModeProps {
  mode: 'define'
  desiredChecked: Set<string>
  onChange: (next: Set<string>) => void
  knownAgents: string[]
}
interface OverrideModeProps {
  mode: 'override'
  classGrants: AppGrant[]
  userGrants: AppGrant[]
  onToggle: (kind: GrantKind, key: string, value: string | null, nextChecked: boolean) => void
  knownAgents: string[]
}

/**
 * One checkbox row. Define mode: plain boolean. Override mode: 3-state.
 * `itemKey` (the grant's `key` column value, e.g. "item_cost" or "view.debt") is a plain data
 * prop — deliberately NOT named `key`, since that's a reserved React prop that would silently be
 * swallowed rather than passed through.
 */
function Item({
  label, itemKey, mode, checked, state, disabledNote, onSetChecked, onToggle,
}: {
  label: string
  itemKey: string
  mode: 'define' | 'override'
  checked?: boolean
  state?: PermissionState
  disabledNote?: string
  onSetChecked?: (checked: boolean) => void
  onToggle?: (nextChecked: boolean) => void
}) {
  void itemKey // not rendered directly; kept on the props type as documentation of which grant this row is
  if (disabledNote) {
    return (
      <label className="perm-item perm-item-disabled">
        <input type="checkbox" disabled />
        <span>{label}</span>
        <span className="perm-item-note">{disabledNote}</span>
      </label>
    )
  }
  if (mode === 'define') {
    return (
      <label className="perm-item">
        <input type="checkbox" checked={checked} onChange={e => onSetChecked?.(e.target.checked)} />
        <span>{label}</span>
      </label>
    )
  }
  // override mode: inherited (unchecked box, grey) / added (checked, green) / removed (checked box, red strike)
  const isChecked = state === 'added' || state === 'inherited'
  return (
    <label className={`perm-item perm-item-${state}`}>
      <input
        type="checkbox"
        checked={isChecked}
        onChange={e => onToggle?.(e.target.checked)}
      />
      <span>{label}</span>
      {state === 'added' && <span className="perm-badge perm-badge-added">added</span>}
      {state === 'removed' && <span className="perm-badge perm-badge-removed">removed</span>}
    </label>
  )
}

/**
 * Split into two fully-typed branches rather than inline `props.mode === 'x' ? … : undefined`
 * ternaries around each callback. TypeScript's discriminated-union narrowing does not follow
 * `props` into a nested arrow function created inside a ternary branch -- the callback body is
 * still checked against the full `DefineModeProps | OverrideModeProps` union, so `props.onToggle`
 * (only on `OverrideModeProps`) fails to typecheck even though it's reached only when
 * `props.mode === 'override'` is true at that point in the JSX. Passing each branch's already
 * fully-typed `props` into its own component sidesteps the issue entirely -- no narrowing needed
 * inside `DefineSections`/`OverrideSections`, since each only ever receives one concrete type.
 */
export function PermissionSections(props: DefineModeProps | OverrideModeProps) {
  if (props.mode === 'define') return <DefineSections {...props} />
  return <OverrideSections {...props} />
}

function DefineSections(props: DefineModeProps) {
  function isChecked(kind: GrantKind, key: string, value: string | null): boolean {
    return props.desiredChecked.has(`${kind}:${key}:${value ?? ''}`)
  }
  function setChecked(kind: GrantKind, key: string, value: string | null, checked: boolean) {
    const next = new Set(props.desiredChecked)
    const itemKeyStr = `${kind}:${key}:${value ?? ''}`
    if (checked) next.add(itemKeyStr)
    else next.delete(itemKeyStr)
    props.onChange(next)
  }
  const assignedAgents = [...props.desiredChecked]
    .filter(k => k.startsWith('scope:agent:') && k !== 'scope:agent:')
    .map(k => k.split(':')[2])

  return (
    <div className="perm-sections">
      <section className="perm-section">
        <h3>Companies & Agents</h3>
        <div className="perm-grid">
          {COMPANIES.map(c => (
            <Item
              key={c}
              label={c}
              itemKey={c}
              mode="define"
              checked={isChecked('scope', 'company', c)}
              onSetChecked={(v) => setChecked('scope', 'company', c, v)}
            />
          ))}
        </div>
        <div className="perm-agent-picker">
          <p className="perm-subhead">Agents</p>
          {assignedAgents.map(a => (
            <Item
              key={a}
              label={a}
              itemKey={a}
              mode="define"
              checked={isChecked('scope', 'agent', a)}
              onSetChecked={(v) => setChecked('scope', 'agent', a, v)}
            />
          ))}
          <select
            value=""
            onChange={e => {
              const agent = e.target.value
              if (!agent) return
              setChecked('scope', 'agent', agent, true)
              e.target.value = ''
            }}
          >
            <option value="">+ add agent…</option>
            {props.knownAgents.filter(a => !assignedAgents.includes(a)).map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="perm-section">
        <h3>Data Fields</h3>
        {FIELDS.map(f => (
          <Item
            key={f.key}
            label={f.label}
            itemKey={f.key}
            mode="define"
            checked={isChecked('field', f.key, null)}
            disabledNote={
              f.wired
                ? undefined
                : 'not yet configurable per-user — still super-admin-only; needs get_dashboard_aux to read this flag before it can take effect'
            }
            onSetChecked={(v) => setChecked('field', f.key, null, v)}
          />
        ))}
      </section>

      <section className="perm-section">
        <h3>Pages & Widgets</h3>
        {VIEWS.map(v => (
          <div key={v}>
            <Item
              key={`view.${v}`}
              label={v}
              itemKey={`view.${v}`}
              mode="define"
              checked={isChecked('node', `view.${v}`, null)}
              onSetChecked={(checked) => setChecked('node', `view.${v}`, null, checked)}
            />
            {v === 'oversite' && (
              <div className="perm-nested">
                {OVERSITE_WIDGETS.map(w => (
                  <Item
                    key={`widget.${w}`}
                    label={w}
                    itemKey={`widget.${w}`}
                    mode="define"
                    checked={isChecked('node', `widget.${w}`, null)}
                    onSetChecked={(checked) => setChecked('node', `widget.${w}`, null, checked)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  )
}

function OverrideSections(props: OverrideModeProps) {
  function overrideState(kind: GrantKind, key: string, value: string | null): PermissionState {
    return resolveOverrideState(props.classGrants, props.userGrants, kind, key, value)
  }
  // Agents worth showing a row for: anything the class grants, plus anything the user has an
  // explicit allow override for -- NOT filtered by "not removed", since a removed item still
  // needs its row visible (unchecked, red badge) so the admin can see and re-add it.
  const relevantAgents = props.knownAgents.filter(a =>
    props.classGrants.some(g => g.kind === 'scope' && g.key === 'agent' && g.value === a)
    || props.userGrants.some(g => g.kind === 'scope' && g.key === 'agent' && g.value === a),
  )

  return (
    <div className="perm-sections">
      <section className="perm-section">
        <h3>Companies & Agents</h3>
        <div className="perm-grid">
          {COMPANIES.map(c => (
            <Item
              key={c}
              label={c}
              itemKey={c}
              mode="override"
              state={overrideState('scope', 'company', c)}
              onToggle={(v) => props.onToggle('scope', 'company', c, v)}
            />
          ))}
        </div>
        <div className="perm-agent-picker">
          <p className="perm-subhead">Agents</p>
          {relevantAgents.map(a => (
            <Item
              key={a}
              label={a}
              itemKey={a}
              mode="override"
              state={overrideState('scope', 'agent', a)}
              onToggle={(v) => props.onToggle('scope', 'agent', a, v)}
            />
          ))}
          <select
            value=""
            onChange={e => {
              const agent = e.target.value
              if (!agent) return
              props.onToggle('scope', 'agent', agent, true)
              e.target.value = ''
            }}
          >
            <option value="">+ add agent…</option>
            {props.knownAgents.filter(a => !relevantAgents.includes(a)).map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="perm-section">
        <h3>Data Fields</h3>
        {FIELDS.map(f => (
          <Item
            key={f.key}
            label={f.label}
            itemKey={f.key}
            mode="override"
            state={overrideState('field', f.key, null)}
            disabledNote={
              f.wired
                ? undefined
                : 'not yet configurable per-user — still super-admin-only; needs get_dashboard_aux to read this flag before it can take effect'
            }
            onToggle={(v) => props.onToggle('field', f.key, null, v)}
          />
        ))}
      </section>

      <section className="perm-section">
        <h3>Pages & Widgets</h3>
        {VIEWS.map(v => (
          <div key={v}>
            <Item
              key={`view.${v}`}
              label={v}
              itemKey={`view.${v}`}
              mode="override"
              state={overrideState('node', `view.${v}`, null)}
              onToggle={(checked) => props.onToggle('node', `view.${v}`, null, checked)}
            />
            {v === 'oversite' && (
              <div className="perm-nested">
                {OVERSITE_WIDGETS.map(w => (
                  <Item
                    key={`widget.${w}`}
                    label={w}
                    itemKey={`widget.${w}`}
                    mode="override"
                    state={overrideState('node', `widget.${w}`, null)}
                    onToggle={(checked) => props.onToggle('node', `widget.${w}`, null, checked)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  )
}
