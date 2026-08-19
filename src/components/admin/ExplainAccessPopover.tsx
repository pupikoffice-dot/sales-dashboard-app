import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { explainAccess } from '../../lib/permissionsApi'
import type { GrantKind } from '../../types/permissions'

export interface ExplainItem {
  kind: GrantKind
  key: string
  label: string
}

export function ExplainAccessPopover({ userId, items, sectionLabel }: {
  userId: string
  items: ExplainItem[]
  sectionLabel: string
}) {
  const [open, setOpen] = useState(false)
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['explain-access-section', userId, sectionLabel, items.map(i => `${i.kind}:${i.key}`).join(',')],
    queryFn: async () => {
      const results = await Promise.all(items.map(item => explainAccess(userId, item.kind, item.key)))
      return items.map((item, i) => ({ item, rows: results[i] }))
    },
    enabled: false,
  })

  return (
    <span className="explain-popover">
      <button
        type="button"
        className="explain-why-btn"
        onClick={() => {
          setOpen(o => !o)
          if (!open) void refetch()
        }}
      >
        why?
      </button>
      {open && (
        <div className="explain-popover-body">
          <p className="explain-popover-title">{sectionLabel}</p>
          {isFetching && <p>{'Loading…'}</p>}
          {!isFetching && data?.map(({ item, rows }) => (
            <div key={`${item.kind}:${item.key}`} className="explain-item-group">
              <p className="explain-item-label">{item.label}</p>
              {rows.length === 0 && <p className="explain-row">nothing sets this — not granted by class or user</p>}
              {rows.map((row, i) => (
                <p key={i} className={row.winning ? 'explain-row explain-row-winning' : 'explain-row'}>
                  {(row.value ?? item.key)}: {row.effect} by {row.source}
                  {row.winning ? ' (in effect)' : ''}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </span>
  )
}
