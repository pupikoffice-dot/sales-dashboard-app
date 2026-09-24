export type LayoutWidth = 'full' | 'half' | 'third'
export type LayoutAccent = 'indigo' | 'green' | 'amber' | 'slate'
export type LayoutDensity = 'comfortable' | 'compact'
export type LayoutCardStyle = 'soft' | 'solid' | 'outline'
export type LayoutSurface = 'classic' | 'suite'
export type SuiteKind = 'agent' | 'manager'

export interface LayoutCard {
  id: string
  /** Named snap used by the width select; kept in sync with cols. */
  width: LayoutWidth
  /** 1–12 grid columns. Mouse resize writes this. */
  cols: number
  /** Pixel height from mouse resize; null = natural height. */
  heightPx: number | null
  hidden: boolean
}

export interface LayoutStyle {
  accent: LayoutAccent
  density: LayoutDensity
  cardStyle: LayoutCardStyle
}

export interface OversightBoard {
  cards: LayoutCard[]
  style: LayoutStyle
}

export interface ClassOversightLayout {
  classic: OversightBoard
  suite: OversightBoard
}

export const CLASSIC_CARD_IDS = [
  'ordersToday',
  'ordersMtd',
  'openOrders',
  'salesMtd',
  'topItems',
  'suppliers',
  'returns',
  'debt',
  'receipts',
  'stockAlerts',
] as const

export const SUITE_CARD_IDS = [
  'salesMtd',
  'openOrders',
  'tsometOpenBudget',
  'returns',
  'openDebt',
  'ordersLast7',
  'receipts',
  'yearNetSales',
] as const

export type ClassicCardId = (typeof CLASSIC_CARD_IDS)[number]
export type SuiteCardId = (typeof SUITE_CARD_IDS)[number]

export const WIDTH_COLS: Record<LayoutWidth, number> = {
  full: 12,
  half: 6,
  third: 4,
}

export const MIN_CARD_COLS = 2
export const MAX_CARD_COLS = 12
export const MIN_CARD_HEIGHT_PX = 120
export const MAX_CARD_HEIGHT_PX = 900

export function widthFromCols(cols: number): LayoutWidth {
  if (cols >= 10) return 'full'
  if (cols >= 5) return 'half'
  return 'third'
}

export function clampCols(cols: number): number {
  return Math.min(MAX_CARD_COLS, Math.max(MIN_CARD_COLS, Math.round(cols)))
}

export function clampHeightPx(px: number): number {
  return Math.min(MAX_CARD_HEIGHT_PX, Math.max(MIN_CARD_HEIGHT_PX, Math.round(px)))
}

export function cardCols(card: LayoutCard): number {
  if (typeof card.cols === 'number' && Number.isFinite(card.cols)) return clampCols(card.cols)
  return WIDTH_COLS[card.width] ?? 4
}

export function cardHeightPx(card: LayoutCard): number | null {
  if (typeof card.heightPx === 'number' && Number.isFinite(card.heightPx) && card.heightPx > 0) {
    return clampHeightPx(card.heightPx)
  }
  return null
}

export const DEFAULT_STYLE: LayoutStyle = {
  accent: 'indigo',
  density: 'comfortable',
  cardStyle: 'soft',
}

const WIDTHS = new Set<string>(['full', 'half', 'third'])
const ACCENTS = new Set<string>(['indigo', 'green', 'amber', 'slate'])
const DENSITIES = new Set<string>(['comfortable', 'compact'])
const CARD_STYLES = new Set<string>(['soft', 'solid', 'outline'])

export function classicCardLabel(id: string): string {
  const labels: Record<string, string> = {
    ordersToday: 'Orders Today',
    ordersMtd: 'Orders MTD',
    openOrders: 'Open Orders',
    salesMtd: 'Sales MTD',
    topItems: 'Top 10 Items',
    suppliers: 'Suppliers',
    returns: 'Returns MTD',
    debt: 'Open Debt',
    receipts: 'Receipts',
    stockAlerts: 'Stock Alerts',
  }
  return labels[id] ?? id
}

export function suiteCardLabel(id: string): string {
  const labels: Record<string, string> = {
    salesMtd: 'Sales MTD + Goal',
    openOrders: 'Open orders',
    tsometOpenBudget: 'Tsomet open budget',
    returns: 'Returns',
    openDebt: 'Open debt',
    ordersLast7: 'Orders last 7 days',
    receipts: 'Receipts',
    yearNetSales: 'Sales year graph (891)',
  }
  return labels[id] ?? id
}

function defaultWidth(surface: LayoutSurface, id: string): LayoutWidth {
  if (surface === 'classic') return 'third'
  if (id === 'yearNetSales') return 'full'
  if (id === 'ordersLast7' || id === 'receipts') return 'half'
  return 'third'
}

export function seedClassicBoard(): OversightBoard {
  return {
    cards: CLASSIC_CARD_IDS.map(id => {
      const width = 'third' as const
      return { id, width, cols: WIDTH_COLS[width], heightPx: null, hidden: false }
    }),
    style: { ...DEFAULT_STYLE },
  }
}

export function seedSuiteBoard(kind: SuiteKind): OversightBoard {
  return {
    cards: SUITE_CARD_IDS.map(id => {
      const width = defaultWidth('suite', id)
      return {
        id,
        width,
        cols: WIDTH_COLS[width],
        heightPx: null,
        hidden: kind === 'agent' && id === 'ordersLast7',
      }
    }),
    style: { ...DEFAULT_STYLE },
  }
}

export function seedClassLayout(kind: SuiteKind): ClassOversightLayout {
  return {
    classic: seedClassicBoard(),
    suite: seedSuiteBoard(kind),
  }
}

function asWidth(value: unknown, fallback: LayoutWidth): LayoutWidth {
  return typeof value === 'string' && WIDTHS.has(value) ? (value as LayoutWidth) : fallback
}

function asStyle(raw: unknown): LayoutStyle {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    accent: typeof o.accent === 'string' && ACCENTS.has(o.accent) ? (o.accent as LayoutAccent) : DEFAULT_STYLE.accent,
    density:
      typeof o.density === 'string' && DENSITIES.has(o.density)
        ? (o.density as LayoutDensity)
        : DEFAULT_STYLE.density,
    cardStyle:
      typeof o.cardStyle === 'string' && CARD_STYLES.has(o.cardStyle)
        ? (o.cardStyle as LayoutCardStyle)
        : DEFAULT_STYLE.cardStyle,
  }
}

function asCols(row: Record<string, unknown>, width: LayoutWidth): number {
  if (typeof row.cols === 'number' && Number.isFinite(row.cols)) return clampCols(row.cols)
  if (typeof row.cols === 'string' && row.cols.trim() !== '') {
    const n = Number(row.cols)
    if (Number.isFinite(n)) return clampCols(n)
  }
  return WIDTH_COLS[width]
}

function asHeightPx(row: Record<string, unknown>): number | null {
  if (row.heightPx == null || row.heightPx === false) return null
  if (typeof row.heightPx === 'number' && Number.isFinite(row.heightPx) && row.heightPx > 0) {
    return clampHeightPx(row.heightPx)
  }
  if (typeof row.heightPx === 'string' && row.heightPx.trim() !== '') {
    const n = Number(row.heightPx)
    if (Number.isFinite(n) && n > 0) return clampHeightPx(n)
  }
  return null
}

export function normalizeBoard(
  raw: unknown,
  surface: LayoutSurface,
  suiteKind: SuiteKind,
): OversightBoard {
  const known = surface === 'classic' ? [...CLASSIC_CARD_IDS] : [...SUITE_CARD_IDS]
  const knownSet = new Set<string>(known)
  const seed = surface === 'classic' ? seedClassicBoard() : seedSuiteBoard(suiteKind)
  const incoming = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const rawCards = Array.isArray(incoming.cards) ? incoming.cards : []
  const seen = new Set<string>()
  const cards: LayoutCard[] = []
  for (const item of rawCards) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id : ''
    if (!knownSet.has(id) || seen.has(id)) continue
    seen.add(id)
    const width = asWidth(row.width, defaultWidth(surface, id))
    const cols = asCols(row, width)
    cards.push({
      id,
      width: widthFromCols(cols),
      cols,
      heightPx: asHeightPx(row),
      hidden: row.hidden === true,
    })
  }
  for (const id of known) {
    if (seen.has(id)) continue
    const seeded = seed.cards.find(c => c.id === id)!
    cards.push({ ...seeded })
  }
  return { cards, style: asStyle(incoming.style) }
}

export function parseClassLayout(raw: unknown, suiteKind: SuiteKind): ClassOversightLayout {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    classic: normalizeBoard(o.classic, 'classic', suiteKind),
    suite: normalizeBoard(o.suite, 'suite', suiteKind),
  }
}

export function visibleCards(board: OversightBoard): LayoutCard[] {
  return board.cards.filter(c => !c.hidden)
}

/** Pack cards left-to-right on a 12-column row; wrap when the next card does not fit. */
export function packRows(cards: LayoutCard[]): LayoutCard[][] {
  const rows: LayoutCard[][] = []
  let row: LayoutCard[] = []
  let used = 0
  for (const card of cards) {
    const span = cardCols(card)
    if (used > 0 && used + span > 12) {
      rows.push(row)
      row = []
      used = 0
    }
    row.push(card)
    used += span
  }
  if (row.length) rows.push(row)
  return rows
}

export function suiteKindFromGrantKeys(keys: Iterable<string>): SuiteKind {
  for (const key of keys) {
    if (key.includes('ui.oversight.suite.sales_agent')) return 'agent'
  }
  return 'manager'
}

export function moveCard(cards: LayoutCard[], from: number, to: number): LayoutCard[] {
  if (from === to || from < 0 || to < 0 || from >= cards.length || to >= cards.length) return cards
  const next = [...cards]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item!)
  return next
}

export function moveCardById(cards: LayoutCard[], fromId: string, toId: string): LayoutCard[] {
  return moveCard(
    cards,
    cards.findIndex(c => c.id === fromId),
    cards.findIndex(c => c.id === toId),
  )
}

export function setCardHidden(cards: LayoutCard[], id: string, hidden: boolean): LayoutCard[] {
  return cards.map(c => (c.id === id ? { ...c, hidden } : c))
}

export function setCardSize(
  cards: LayoutCard[],
  id: string,
  size: { cols?: number; heightPx?: number | null },
): LayoutCard[] {
  return cards.map(c => {
    if (c.id !== id) return c
    const cols = size.cols != null ? clampCols(size.cols) : cardCols(c)
    const heightPx =
      size.heightPx === undefined
        ? c.heightPx
        : size.heightPx == null
          ? null
          : clampHeightPx(size.heightPx)
    return { ...c, cols, width: widthFromCols(cols), heightPx }
  })
}

export function boardStyleAttrs(style: LayoutStyle): Record<string, string> {
  return {
    'data-ov-accent': style.accent,
    'data-ov-density': style.density,
    'data-ov-card': style.cardStyle,
  }
}

export function flowWidthClass(width: LayoutWidth): string {
  return `ov-flow ov-flow--${width}`
}

export function flowCardStyle(card: LayoutCard): { gridColumn: string; minHeight?: string } {
  const style: { gridColumn: string; minHeight?: string } = {
    gridColumn: `span ${cardCols(card)}`,
  }
  const h = cardHeightPx(card)
  if (h != null) style.minHeight = `${h}px`
  return style
}

/** After a save: show the cube only if the board lists it and it is not hidden. */
export function boardShowsCard(board: OversightBoard, id: string): boolean {
  return board.cards.some(c => c.id === id && !c.hidden)
}
