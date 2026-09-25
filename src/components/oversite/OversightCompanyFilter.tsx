import { useMemo, useState } from 'react'
import { useLocale } from '../../context/LocaleContext'
import { OVERSITE_COMPANIES } from '../../lib/oversiteMetrics'
import type { LogicalCompany } from '../../types/dashboard'
import { FilterCheckList } from '../sidebar/FilterCheckList'

interface OversightCompanyFilterProps {
  allowed: LogicalCompany[]
  selected: Set<LogicalCompany>
  onChange: (next: Set<LogicalCompany>) => void
}

export function OversightCompanyFilter({ allowed, selected, onChange }: OversightCompanyFilterProps) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)

  const options = useMemo(() => {
    const byId = new Map(OVERSITE_COMPANIES.map(c => [c.id, c.label]))
    return allowed.map(id => ({ id, label: byId.get(id) ?? id }))
  }, [allowed])

  const filterActive = selected.size < allowed.length

  if (allowed.length <= 1) return null

  return (
    <div className="ov-co-filter">
      <button
        type="button"
        className={`ov-toggle-btn${filterActive ? ' active' : ''}`}
        onClick={() => setOpen(v => !v)}
      >
        🏢 {t('oversite.companyFilter')}{' '}
        {filterActive ? `(${selected.size}/${allowed.length})` : ''} {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="ov-co-filter-panel">
          <FilterCheckList
            items={options}
            selected={selected}
            onToggle={id => {
              const co = id as LogicalCompany
              onChange(
                (() => {
                  const next = new Set(selected)
                  if (next.has(co)) next.delete(co)
                  else next.add(co)
                  return next
                })(),
              )
            }}
            onSelectVisible={ids => onChange(new Set(ids as LogicalCompany[]))}
            onClear={() => onChange(new Set())}
            searchPlaceholder={t('oversite.companyFilterSearch')}
            maxHeight={160}
          />
        </div>
      )}
    </div>
  )
}
