import type { AppTheme } from './theme'

/** Dark-mode pie / chart slice palette (vivid on dark backgrounds). */
export const PIE_COLORS_DARK = [
  '#4f7ef8', '#7c3aed', '#22c55e', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#a855f7',
  '#14b8a6', '#e11d48', '#0ea5e9', '#d97706', '#10b981',
  '#6366f1', '#b45309', '#be185d', '#047857', '#9333ea',
  '#38bdf8', '#fb7185', '#4ade80', '#facc15', '#c084fc',
  '#2dd4bf', '#f472b6', '#a3e635', '#fb923c', '#818cf8',
  '#34d399', '#fecdd3', '#67e8f9', '#fde68a', '#d8b4fe',
  '#6ee7b7', '#fda4af', '#a5f3fc', '#fef08a', '#e9d5ff',
  '#86efac', '#fecaca', '#bae6fd', '#fed7aa', '#f5d0fe',
  '#4dd4ac', '#c4b5fd', '#86d9f0', '#fbbf24', '#f87171',
]

/** Light-mode pie / chart slice palette (muted greys & earth tones). */
export const PIE_COLORS_LIGHT = [
  '#6b7280', '#57534e', '#047857', '#b45309', '#b91c1c',
  '#0e7490', '#9d174d', '#15803d', '#c2410c', '#505057',
  '#0369a1', '#831843', '#065f46', '#92400e', '#991b1b',
  '#4b5563', '#a16207', '#be123c', '#059669', '#78716c',
  '#155e75', '#9f1239', '#166534', '#ca8a04', '#71717a',
  '#0f766e', '#701a75', '#3f6212', '#ea580c', '#52525b',
  '#115e59', '#881337', '#14532d', '#d97706', '#dc2626',
  '#334155', '#fdba74', '#bae6fd', '#fde68a', '#d6d3d1',
  '#86efac', '#fecaca', '#cbd5e1', '#fed7aa', '#e7e5e4',
  '#5eead4', '#a8a29e', '#93c5fd', '#fcd34d', '#fca5a5',
]

/** @deprecated use getPieColors(theme) */
export const PIE_COLORS = PIE_COLORS_DARK

export function getPieColors(theme: AppTheme = 'dark'): readonly string[] {
  return theme === 'light' ? PIE_COLORS_LIGHT : PIE_COLORS_DARK
}
