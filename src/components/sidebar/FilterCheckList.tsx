import { useMemo, useRef, useState } from 'react'
import { useLocale } from '../../context/LocaleContext'
import {
  applySearchTyping,
  emptySearchSelectState,
  noteSearchToggle,
} from '../../lib/filterSearchSelect'
import type { ListOption } from '../../lib/salesFilterLists'

interface FilterCheckListProps {
  items: ListOption[]
  selected: Set<string>
  onToggle: (id: string) => void
  onSelectVisible: (ids: string[]) => void
  /** Replace the whole selection (sidebar searches). Without it, typing only narrows the list. */
  onSetSelected?: (ids: string[]) => void
  onClear: () => void
  searchPlaceholder: string
  /** Category lists match the start of the name. Client and supplier lists match anywhere. */
  match?: 'includes' | 'prefix'
  /** Items list: extra box that keeps only SKUs starting with the text. */
  skuFilter?: boolean
  skuPlaceholder?: string
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
  onSetSelected,
  onClear,
  searchPlaceholder,
  match = 'includes',
  skuFilter = false,
  skuPlaceholder = '',
  maxHeight = 200,
}: FilterCheckListProps) {
  const { t } = useLocale()
  const [search, setSearch] = useState('')
  const [sku, setSku] = useState('')
  const [scrollTop, setScrollTop] = useState(0)
  const searchState = useRef(emptySearchSelectState())
  const queryRef = useRef('')

  const nameQ = search.trim().toLowerCase()
  const skuQ = sku.trim().toLowerCase()

  const visible = useMemo(() => {
    return items.filter(item => {
      if (skuQ && !item.id.toLowerCase().startsWith(skuQ)) return false
      if (!nameQ) return true
      const label = item.label.toLowerCase()
      return match === 'prefix' ? label.startsWith(nameQ) || item.id.toLowerCase().startsWith(nameQ) : label.includes(nameQ)
    })
  }, [items, nameQ, skuQ, match])

  const useVirtual = visible.length > VIRTUAL_THRESHOLD
  const viewportRows = Math.ceil(maxHeight / ROW_HEIGHT) + OVERSCAN * 2
  const startIdx = useVirtual ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN) : 0
  const endIdx = useVirtual ? Math.min(visible.length, startIdx + viewportRows) : visible.length
  const windowItems = visible.slice(startIdx, endIdx)
  const totalHeight = visible.length * ROW_HEIGHT
  const offsetY = startIdx * ROW_HEIGHT

  function queryKey(name: string, skuText: string) {
    const n = name.trim().toLowerCase()
    const s = skuText.trim().toLowerCase()
    return n || s ? `${s}|${n}` : ''
  }

  function visibleIds(name: string, skuText: string) {
    const n = name.trim().toLowerCase()
    const s = skuText.trim().toLowerCase()
    return items
      .filter(item => {
        if (s && !item.id.toLowerCase().startsWith(s)) return false
        if (!n) return true
        const label = item.label.toLowerCase()
        return match === 'prefix' ? label.startsWith(n) || item.id.toLowerCase().startsWith(n) : label.includes(n)
      })
      .map(item => item.id)
  }

  function changeQuery(nextName: string, nextSku: string) {
    const nextQuery = queryKey(nextName, nextSku)
    if (onSetSelected) {
      const result = applySearchTyping(searchState.current, {
        prevQuery: queryRef.current,
        nextQuery,
        selected: [...selected],
        matchIds: nextQuery ? visibleIds(nextName, nextSku) : [],
      })
      searchState.current = result.state
      if (result.selected) onSetSelected(result.selected)
    }
    queryRef.current = nextQuery
    setSearch(nextName)
    setSku(nextSku)
    setScrollTop(0)
  }

  function handleToggle(id: string) {
    if (queryRef.current) {
      searchState.current = noteSearchToggle(searchState.current, id, selected.has(id))
    }
    onToggle(id)
  }

  function handleClear() {
    searchState.current = emptySearchSelectState()
    queryRef.current = ''
    setSearch('')
    setSku('')
    onClear()
  }

  function selectAll() {
    onSelectVisible(visible.map(i => i.id))
  }

  function rows(list: ListOption[]) {
    return list.map(item => (
      <label key={item.id} className="ck" title={item.label} style={useVirtual ? { minHeight: ROW_HEIGHT } : undefined}>
        <input type="checkbox" checked={selected.has(item.id)} onChange={() => handleToggle(item.id)} />
        <span className="ck-label">{skuFilter ? `${item.id} · ${item.label}` : item.label}</span>
      </label>
    ))
  }

  return (
    <>
      {skuFilter && (
        <input
          className="srch"
          type="text"
          placeholder={skuPlaceholder}
          value={sku}
          onChange={e => changeQuery(search, e.target.value)}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
        />
      )}
      <input
        className="srch"
        type="text"
        placeholder={searchPlaceholder}
        value={search}
        onChange={e => changeQuery(e.target.value, sku)}
      />
      <div className="mini-row">
        <button type="button" className="mini" onClick={selectAll}>
          {t('common.all')}
        </button>
        <button type="button" className="mini" onClick={handleClear}>
          {t('common.clear')}
        </button>
        {items.length > VIRTUAL_THRESHOLD && !nameQ && !skuQ && (
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
            <div style={{ position: 'absolute', top: offsetY, left: 0, right: 0 }}>{rows(windowItems)}</div>
          </div>
        ) : (
          rows(windowItems)
        )}
      </div>
    </>
  )
}
