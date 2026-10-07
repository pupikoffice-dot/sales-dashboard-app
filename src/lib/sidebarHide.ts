/** Sidebar buttons an admin can hide per user. Checked = hidden. */

export interface SidebarHideOption {
  id: string
  label: string
}

export interface SidebarHideGroup {
  title: string
  options: SidebarHideOption[]
}

export const SIDEBAR_HIDE_GROUPS: SidebarHideGroup[] = [
  {
    title: 'Navigation',
    options: [
      { id: 'nav.oversite', label: 'Oversight' },
      { id: 'nav.sales_performance', label: 'Sales' },
      { id: 'nav.orders_mtd', label: 'Orders MTD' },
      { id: 'nav.open_orders', label: 'Open Orders' },
      { id: 'nav.returns', label: 'Returns' },
      { id: 'nav.debt', label: 'Debt' },
      { id: 'nav.stock_alerts', label: 'Stock Alerts' },
      { id: 'nav.stock', label: 'Stock' },
      { id: 'nav.export', label: 'Export' },
    ],
  },
  {
    title: 'Operations',
    options: [{ id: 'nav.ops_deliveries', label: 'Deliveries' }],
  },
  {
    title: 'Filters',
    options: [
      { id: 'company.pupik', label: 'Company — Pupik' },
      { id: 'company.mt', label: 'Company — Monkeytime' },
      { id: 'company.grow', label: 'Company — Grow' },
      { id: 'company.gold', label: 'Company — Goldbug' },
      { id: 'date.range', label: 'Date — From / To' },
      { id: 'date.months', label: 'Date — Months' },
      { id: 'date.openorders', label: 'Date — Open orders' },
      { id: 'date.stock', label: 'Date — Stock' },
      { id: 'date.items', label: 'Filter — Items index' },
      { id: 'view.clients', label: 'View — Clients' },
      { id: 'view.items', label: 'View — Items' },
      { id: 'view.suppliers', label: 'View — Suppliers' },
      { id: 'cat.tablet', label: 'Items — Tablet category' },
      { id: 'cat.group', label: 'Items — Group category' },
      { id: 'clientMode.items', label: 'Clients — Items breakdown' },
      { id: 'clientMode.cash', label: 'Clients — Cash summary' },
      { id: 'itemMode.clients', label: 'Items — By clients' },
      { id: 'itemMode.items', label: 'Items — Items summary' },
      { id: 'supplierMode.items', label: 'Suppliers — Items breakdown' },
      { id: 'supplierMode.cash', label: 'Suppliers — Cash summary' },
    ],
  },
  {
    title: 'Skins (look) the user may choose',
    options: [{ id: 'skin.bento', label: 'Skin — Bento' }],
  },
  {
    title: 'Items index columns',
    options: [
      { id: 'items.col.cost', label: 'Landed cost (REP907 E)' },
      { id: 'items.col.fob', label: 'FOB price (REP907 K)' },
    ],
  },
]

export const SIDEBAR_HIDE_OPTIONS: SidebarHideOption[] = SIDEBAR_HIDE_GROUPS.flatMap(g => g.options)

export function sidebarNavHideId(moduleId: string): string {
  return `nav.${moduleId}`
}
