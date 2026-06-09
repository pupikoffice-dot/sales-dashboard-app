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

const ROW_HEIGHT = 22
const OVERSCAN = 6
const VIRTUAL_THRESHOLD = 80

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
  const [scrollTop, setScrollTop] = useState(0)
  const q = search.trim().toLowerCase()

  const visible = useMemo(
    () => (q ? items.filter(i => i.label.toLowerCase().includes(q)) : items),
    [items, q],
  )

  const useVirtual = visible.length > VIRTUAL_THRESHOLD
  const viewportRows = Math.ceil(maxHeight / ROW_HEIGHT) + OVERSCAN * 2
  const startIdx = useVirtual ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN) : 0
  const endIdx = useVirtual
    ? Math.min(visible.length, startIdx + viewportRows)
    : visible.length
  const windowItems = visible.slice(startIdx, endIdx)
  const totalHeight = visible.length * ROW_HEIGHT
  const offsetY = startIdx * ROW_HEIGHT

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
        onChange={e => {
          setSearch(e.target.value)
          setScrollTop(0)
        }}
      />
      <div className="mini-row">
        <button type="button" className="mini" onClick={selectAll}>
          {t('common.all')}
        </button>
        <button type="button" className="mini" onClick={onClear}>
          {t('common.clear')}
        </button>
        {items.length > VIRTUAL_THRESHOLD && !q && (
          <span className="sel-months-list" style={{ margin: 0, flex: 1, textAlign: 'right' }}>
            {items.length.toLocaleString()} {t('filters.listTotal')}
          </span>
        )}
      </div>
      <div
        className="chk-list"
        style={{ maxHeight, overflowY: 'auto' }}
        onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
      >
        {useVirtual ? (
          <div style={{ height: totalHeight, position: 'relative' }}>
            <div style={{ position: 'absolute', top: offsetY, left: 0, right: 0 }}>
              {windowItems.map(item => (
                <label
                  key={item.id}
                  className="ck"
                  title={item.label}
                  style={{ minHeight: ROW_HEIGHT }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => onToggle(item.id)}
                  />
                  <span className="ck-label">{item.label}</span>
                </label>
              ))}
            </div>
          </div>
        ) : (
          windowItems.map(item => (
            <label key={item.id} className="ck" title={item.label}>
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() => onToggle(item.id)}
              />
              <span className="ck-label">{item.label}</span>
            </label>
          ))
        )}
      </div>
    </>
  )
}
