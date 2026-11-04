/**
 * Layout styles (BETA preview). A second, independent axis next to the look "skin": it re-skins the
 * shell and the common panels through CSS tokens keyed on <html data-layout>. "current" sets nothing,
 * so the app looks exactly as before. The choice lives only in this browser's localStorage.
 */
export const LAYOUT_STYLE_IDS = ['current', 'ledger', 'calm', 'console'] as const
export type LayoutStyle = (typeof LAYOUT_STYLE_IDS)[number]

export const DEFAULT_LAYOUT_STYLE: LayoutStyle = 'current'
export const LAYOUT_STYLE_STORAGE_KEY = 'dashboard-layout-style'

export function isLayoutStyle(v: unknown): v is LayoutStyle {
  return typeof v === 'string' && (LAYOUT_STYLE_IDS as readonly string[]).includes(v)
}

export function readStoredLayoutStyle(): LayoutStyle {
  try {
    const v = localStorage.getItem(LAYOUT_STYLE_STORAGE_KEY)
    if (isLayoutStyle(v)) return v
  } catch {
    /* storage blocked: fall back to the current look */
  }
  return DEFAULT_LAYOUT_STYLE
}

export function storeLayoutStyle(style: LayoutStyle): void {
  try {
    localStorage.setItem(LAYOUT_STYLE_STORAGE_KEY, style)
  } catch {
    /* the choice just is not remembered */
  }
}

/** Sets or clears <html data-layout>. A layout style replaces the skin, so the skin layer is parked as classic. */
export function applyLayoutStyle(style: LayoutStyle): void {
  const root = document.documentElement
  if (style === DEFAULT_LAYOUT_STYLE) delete root.dataset.layout
  else root.dataset.layout = style
  const chosenSkin = root.dataset.skinChoice
  if (chosenSkin) root.dataset.skin = style === DEFAULT_LAYOUT_STYLE ? chosenSkin : 'classic'
}
