import { useEffect, useState, type ReactNode } from 'react'
import { companyLabel } from '../../lib/salesMetrics'
import type { LogicalCompany } from '../../types/dashboard'

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return v
}

/** Company chips (when the user has more than one) and a search box, shared by the client card and the item card. */
export function PurchaseSearchBar({
  companies,
  company,
  onCompany,
  query,
  onQuery,
  placeholder,
}: {
  companies: LogicalCompany[]
  company: LogicalCompany
  onCompany: (c: LogicalCompany) => void
  query: string
  onQuery: (q: string) => void
  placeholder: string
}) {
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
      {companies.length > 1 ? (
        <div className="chip-row">
          {companies.map(c => (
            <button key={c} type="button" className={`chip${c === company ? ' active' : ''}`} onClick={() => onCompany(c)}>
              {companyLabel(c)}
            </button>
          ))}
        </div>
      ) : (
        <b>{companyLabel(company)}</b>
      )}
      <input
        className="sbar-search"
        type="text"
        value={query}
        placeholder={placeholder}
        onChange={e => onQuery(e.target.value)}
        aria-label={placeholder}
        style={{ minWidth: 240, flex: '1 1 240px' }}
      />
    </div>
  )
}

/** One KPI tile (label, value, optional small note). */
export function Kpi({ label, value, note, tone, hint }: { label: string; value: ReactNode; note?: ReactNode; tone?: 'grn' | 'amber'; hint?: string }) {
  return (
    <section className="hub-card hub-tile-kpi hub-span-3" title={hint}>
      <div className="hub-kpi-lbl">{label}</div>
      <div className="hub-kpi-main">
        <span className={`hub-kpi-val${tone ? ` ${tone}` : ''}`}>{value}</span>
      </div>
      {note ? <div className="hub-kpi-sub">{note}</div> : null}
    </section>
  )
}
