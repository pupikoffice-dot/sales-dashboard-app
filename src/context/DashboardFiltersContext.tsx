import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { canApplyFilters } from '../lib/filterApply'
import type { LogicalCompany } from '../types/dashboard'

export type DateMode = 'range' | 'months' | 'openorders' | 'stock'
export type ViewMode = 'clients' | 'items'
export type ClientMode = 'items' | 'cash'
export type CatType = 'tablet' | 'category'
export type ItemMode = 'clients' | 'items'

export interface DashboardFiltersState {
  company: LogicalCompany | null
  dateMode: DateMode
  dateFrom: string
  dateTo: string
  selectedMonths: Set<string>
  view: ViewMode | null
  clientMode: ClientMode | null
  catType: CatType | null
  itemMode: ItemMode | null
  selectedClientIds: Set<string>
  selectedCategories: Set<string>
  selectedItemSkus: Set<string>
  applied: boolean
}

interface DashboardFiltersValue extends DashboardFiltersState {
  setCompany: (co: LogicalCompany | null) => void
  setDateMode: (mode: DateMode) => void
  setDateFrom: (v: string) => void
  setDateTo: (v: string) => void
  toggleMonth: (key: string) => void
  clearMonths: () => void
  setView: (v: ViewMode | null) => void
  setClientMode: (m: ClientMode | null) => void
  setCatType: (t: CatType | null) => void
  setItemMode: (m: ItemMode | null) => void
  initClientIds: (ids: string[]) => void
  initCategoryIds: (ids: string[]) => void
  initItemIds: (ids: string[]) => void
  toggleClientId: (id: string) => void
  toggleCategoryId: (id: string) => void
  toggleItemSku: (id: string) => void
  selectClientIds: (ids: string[]) => void
  selectCategoryIds: (ids: string[]) => void
  selectItemSkus: (ids: string[]) => void
  clearClientIds: () => void
  clearCategoryIds: () => void
  clearItemSkus: () => void
  apply: () => void
  canApply: boolean
  viewPanelEnabled: boolean
}

const DashboardFiltersContext = createContext<DashboardFiltersValue | null>(null)

function emptyListSelections() {
  return {
    selectedClientIds: new Set<string>(),
    selectedCategories: new Set<string>(),
    selectedItemSkus: new Set<string>(),
  }
}

function clearViewChain() {
  return {
    view: null as ViewMode | null,
    clientMode: null as ClientMode | null,
    catType: null as CatType | null,
    itemMode: null as ItemMode | null,
    applied: false,
    ...emptyListSelections(),
  }
}

export function DashboardFiltersProvider({ children }: { children: ReactNode }) {
  const [company, setCompanyState] = useState<LogicalCompany | null>(null)
  const [dateMode, setDateModeState] = useState<DateMode>('range')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(() => new Set())
  const [view, setViewState] = useState<ViewMode | null>(null)
  const [clientMode, setClientModeState] = useState<ClientMode | null>(null)
  const [catType, setCatTypeState] = useState<CatType | null>(null)
  const [itemMode, setItemModeState] = useState<ItemMode | null>(null)
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(() => new Set())
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(() => new Set())
  const [selectedItemSkus, setSelectedItemSkus] = useState<Set<string>>(() => new Set())
  const [applied, setApplied] = useState(false)

  const state: DashboardFiltersState = {
    company,
    dateMode,
    dateFrom,
    dateTo,
    selectedMonths,
    view,
    clientMode,
    catType,
    itemMode,
    selectedClientIds,
    selectedCategories,
    selectedItemSkus,
    applied,
  }

  const stateRef = useRef(state)
  stateRef.current = state

  const canApply = useMemo(() => canApplyFilters(state), [
    company,
    dateMode,
    dateFrom,
    dateTo,
    selectedMonths,
    view,
    clientMode,
    catType,
    itemMode,
    selectedClientIds,
    selectedCategories,
    selectedItemSkus,
  ])
  const viewPanelEnabled = !!company && dateMode !== 'stock'

  function invalidateApply() {
    setApplied(false)
  }

  function setCompany(co: LogicalCompany | null) {
    setCompanyState(co)
    const cleared = clearViewChain()
    setViewState(cleared.view)
    setClientModeState(cleared.clientMode)
    setCatTypeState(cleared.catType)
    setItemModeState(cleared.itemMode)
    setSelectedClientIds(cleared.selectedClientIds)
    setSelectedCategories(cleared.selectedCategories)
    setSelectedItemSkus(cleared.selectedItemSkus)
    setApplied(cleared.applied)
  }

  function setDateMode(mode: DateMode) {
    setDateModeState(mode)
    if (mode === 'range') setSelectedMonths(new Set())
    else {
      setDateFrom('')
      setDateTo('')
    }
    const cleared = clearViewChain()
    setViewState(cleared.view)
    setClientModeState(cleared.clientMode)
    setCatTypeState(cleared.catType)
    setItemModeState(cleared.itemMode)
    setSelectedClientIds(cleared.selectedClientIds)
    setSelectedCategories(cleared.selectedCategories)
    setSelectedItemSkus(cleared.selectedItemSkus)
    setApplied(cleared.applied)
  }

  function setView(v: ViewMode | null) {
    setViewState(v)
    setClientModeState(null)
    setCatTypeState(null)
    setItemModeState(null)
    const lists = emptyListSelections()
    setSelectedClientIds(lists.selectedClientIds)
    setSelectedCategories(lists.selectedCategories)
    setSelectedItemSkus(lists.selectedItemSkus)
    setApplied(false)
  }

  function setClientMode(m: ClientMode | null) {
    setClientModeState(m)
    invalidateApply()
  }

  function setCatType(t: CatType | null) {
    setCatTypeState(t)
    setItemModeState(null)
    setSelectedCategories(new Set())
    setSelectedItemSkus(new Set())
    invalidateApply()
  }

  function setItemMode(m: ItemMode | null) {
    setItemModeState(m)
    invalidateApply()
  }

  function initClientIds(ids: string[]) {
    setSelectedClientIds(new Set(ids))
  }

  function initCategoryIds(ids: string[]) {
    setSelectedCategories(new Set(ids))
  }

  function initItemIds(ids: string[]) {
    setSelectedItemSkus(new Set(ids))
  }

  function toggleClientId(id: string) {
    setSelectedClientIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    invalidateApply()
  }

  function toggleCategoryId(id: string) {
    setSelectedCategories(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    invalidateApply()
  }

  function toggleItemSku(id: string) {
    setSelectedItemSkus(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    invalidateApply()
  }

  function selectClientIds(ids: string[]) {
    setSelectedClientIds(prev => {
      const next = new Set(prev)
      ids.forEach(id => next.add(id))
      return next
    })
    invalidateApply()
  }

  function selectCategoryIds(ids: string[]) {
    setSelectedCategories(prev => {
      const next = new Set(prev)
      ids.forEach(id => next.add(id))
      return next
    })
    invalidateApply()
  }

  function selectItemSkus(ids: string[]) {
    setSelectedItemSkus(prev => {
      const next = new Set(prev)
      ids.forEach(id => next.add(id))
      return next
    })
    invalidateApply()
  }

  function clearClientIds() {
    setSelectedClientIds(new Set())
    invalidateApply()
  }

  function clearCategoryIds() {
    setSelectedCategories(new Set())
    invalidateApply()
  }

  function clearItemSkus() {
    setSelectedItemSkus(new Set())
    invalidateApply()
  }

  function toggleMonth(key: string) {
    setSelectedMonths(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    invalidateApply()
  }

  function clearMonths() {
    setSelectedMonths(new Set())
    invalidateApply()
  }

  const apply = useCallback(() => {
    if (!canApplyFilters(stateRef.current)) return
    setApplied(true)
  }, [])

  return (
    <DashboardFiltersContext.Provider
      value={{
        ...state,
        setCompany,
        setDateMode,
        setDateFrom: (v: string) => {
          setDateFrom(v)
          invalidateApply()
        },
        setDateTo: (v: string) => {
          setDateTo(v)
          invalidateApply()
        },
        toggleMonth,
        clearMonths,
        setView,
        setClientMode,
        setCatType,
        setItemMode,
        initClientIds,
        initCategoryIds,
        initItemIds,
        toggleClientId,
        toggleCategoryId,
        toggleItemSku,
        selectClientIds,
        selectCategoryIds,
        selectItemSkus,
        clearClientIds,
        clearCategoryIds,
        clearItemSkus,
        apply,
        canApply,
        viewPanelEnabled,
      }}
    >
      {children}
    </DashboardFiltersContext.Provider>
  )
}

export function useDashboardFilters() {
  const ctx = useContext(DashboardFiltersContext)
  if (!ctx) throw new Error('useDashboardFilters outside DashboardFiltersProvider')
  return ctx
}
