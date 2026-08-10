import type { CatType } from '../context/DashboardFiltersContext'
import type { SalesRow } from '../types/dashboard'
import type { ListOption } from './salesFilterLists'
import { isHiddenSupplier } from './supplierMetrics'

interface TagBuckets {
  clients: Map<string, string>
  tabletCats: Set<string>
  groupCats: Set<string>
  tabletItems: Map<string, Map<string, string>>
  groupItems: Map<string, Map<string, string>>
  suppliers: Set<string>
}

export interface CompanyFilterIndex {
  clients: ListOption[]
  tabletCategories: ListOption[]
  groupCategories: ListOption[]
  itemsByTabletCat: Record<string, ListOption[]>
  itemsByGroupCat: Record<string, ListOption[]>
  suppliers: ListOption[]
}

export interface SalesFilterIndex {
  byCompanyTag: Record<string, CompanyFilterIndex>
}

function toSortedOptions(map: Map<string, string>): ListOption[] {
  return [...map.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([id, label]) => ({ id, label }))
}

function toSortedCatOptions(set: Set<string>): ListOption[] {
  return [...set].sort().map(c => ({ id: c, label: c }))
}

function itemsMapToRecord(map: Map<string, Map<string, string>>): Record<string, ListOption[]> {
  const out: Record<string, ListOption[]> = {}
  for (const [cat, skus] of map) {
    out[cat] = toSortedOptions(skus)
  }
  return out
}

function tagBuckets(store: Record<string, TagBuckets>, tag: string): TagBuckets {
  if (!store[tag]) {
    store[tag] = {
      clients: new Map(),
      tabletCats: new Set(),
      groupCats: new Set(),
      tabletItems: new Map(),
      groupItems: new Map(),
      suppliers: new Set(),
    }
  }
  return store[tag]
}

function addItem(
  map: Map<string, Map<string, string>>,
  cat: string,
  sku: string,
  name: string,
) {
  if (!map.has(cat)) map.set(cat, new Map())
  const items = map.get(cat)!
  if (!items.has(sku)) items.set(sku, name)
}

/** One pass over all rows — used once when dashboard data loads. */
export function buildSalesFilterIndex(rows: SalesRow[]): SalesFilterIndex {
  const store: Record<string, TagBuckets> = {}

  for (const r of rows) {
    const tag = r.company
    if (!tag) continue
    const b = tagBuckets(store, tag)

    if (r.clientID) {
      if (!b.clients.has(r.clientID)) {
        b.clients.set(r.clientID, r.clientName || r.clientID)
      }
    }

    const tabletCat = String(r.tabletCat || '(No Category)')
    const groupCat = String(r.groupCat || '(No Category)')
    b.tabletCats.add(tabletCat)
    b.groupCats.add(groupCat)

    const sku = r.itemSKU || '(No SKU)'
    const name = r.itemName || sku
    addItem(b.tabletItems, tabletCat, sku, name)
    addItem(b.groupItems, groupCat, sku, name)

    const sup = String(r.supplier || '(No supplier)')
    if (!isHiddenSupplier(sup)) b.suppliers.add(sup)
  }

  const byCompanyTag: Record<string, CompanyFilterIndex> = {}
  for (const [tag, b] of Object.entries(store)) {
    byCompanyTag[tag] = {
      clients: toSortedOptions(b.clients),
      tabletCategories: toSortedCatOptions(b.tabletCats),
      groupCategories: toSortedCatOptions(b.groupCats),
      itemsByTabletCat: itemsMapToRecord(b.tabletItems),
      itemsByGroupCat: itemsMapToRecord(b.groupItems),
      suppliers: toSortedCatOptions(b.suppliers),
    }
  }

  return { byCompanyTag }
}

export function getIndexedSupplierOptions(
  index: SalesFilterIndex | undefined,
  companyTag: string | null,
): ListOption[] {
  if (!companyTag || !index) return []
  return index.byCompanyTag[companyTag]?.suppliers ?? []
}

export function getIndexedClientOptions(
  index: SalesFilterIndex | undefined,
  companyTag: string | null,
): ListOption[] {
  if (!companyTag || !index) return []
  return index.byCompanyTag[companyTag]?.clients ?? []
}

export function getIndexedCategoryOptions(
  index: SalesFilterIndex | undefined,
  companyTag: string | null,
  catType: CatType,
): ListOption[] {
  if (!companyTag || !index) return []
  const co = index.byCompanyTag[companyTag]
  if (!co) return []
  return catType === 'tablet' ? co.tabletCategories : co.groupCategories
}

export function getIndexedItemOptions(
  index: SalesFilterIndex | undefined,
  companyTag: string | null,
  catType: CatType,
  selectedCategories: Set<string>,
): ListOption[] {
  if (!companyTag || !index || !selectedCategories.size) return []
  const co = index.byCompanyTag[companyTag]
  if (!co) return []

  const source = catType === 'tablet' ? co.itemsByTabletCat : co.itemsByGroupCat
  const merged = new Map<string, string>()
  for (const cat of selectedCategories) {
    for (const item of source[cat] ?? []) {
      if (!merged.has(item.id)) merged.set(item.id, item.label)
    }
  }
  return toSortedOptions(merged)
}
