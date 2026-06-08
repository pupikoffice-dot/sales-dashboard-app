import { useMemo, useState } from 'react'
import { useLocale } from '../../context/LocaleContext'
import type { ListOption } from '../../lib/salesFilterLists'

interface FilterCheckListProps {
  items: ListOption[]
  selected: Set<string>
  onToggle: (id: string) => void
  onSelectVisible: (ids: string[]) => void
  onClear: () => void
  searchPlaceholder: string
  maxHeight?: number
}

export function FilterCheckList({
  items,
  selected,
  onToggle,
  onSelectVisible,
  onClear,
  searchPlaceholder,
  maxHeight = 200,
}: FilterCheckListProps) {
  const { t } = useLocale()
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()

  const visible = useMemo(
    () => (q ? items.filter(i => i.label.toLowerCase().includes(q)) : items),
    [items, q],
  )

  function selectAll() {
    onSelectVisible(visible.map(i => i.id))
  }

  return (
    <>
      <input
        className="srch"
        type="text"
        placeholder={searchPlaceholder}
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div className="mini-row">
        <button type="button" className="mini" onClick={selectAll}>
          {t('common.all')}
        </button>
        <button type="button" className="mini" onClick={onClear}>
          {t('common.clear')}
        </button>
      </div>
      <div className="chk-list" style={{ maxHeight }}>
        {visible.map(item => (
          <label key={item.id} className="ck" title={item.label}>
            <input
              type="checkbox"
              checked={selected.has(item.id)}
              onChange={() => onToggle(item.id)}
            />
            <span className="ck-label">{item.label}</span>
          </label>
        ))}
      </div>
    </>
  )
}
