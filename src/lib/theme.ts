export type AppTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'dashboard-theme'

export function readStoredTheme(): AppTheme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light'
  }
  return 'dark'
}

export function applyTheme(theme: AppTheme): void {
  document.documentElement.dataset.theme = theme
}
