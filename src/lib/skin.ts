/** Look skins. Classic = the original look (no overrides); others are CSS layers keyed on <html data-skin>. */
export const SKIN_IDS = ['classic', 'bento', 'solid', 'glass'] as const
export type AppSkin = (typeof SKIN_IDS)[number]

export const DEFAULT_SKIN: AppSkin = 'classic'
export const SKIN_STORAGE_KEY = 'dashboard-skin'

export function isAppSkin(v: unknown): v is AppSkin {
  return typeof v === 'string' && (SKIN_IDS as readonly string[]).includes(v)
}

export function readStoredSkin(): AppSkin {
  try {
    const v = localStorage.getItem(SKIN_STORAGE_KEY)
    if (isAppSkin(v)) return v
  } catch {
    /* ignore */
  }
  return DEFAULT_SKIN
}

/** Web fonts a skin needs. They load only when that skin is shown, so other users never download them. */
const SKIN_FONTS: Partial<Record<AppSkin, string>> = {
  glass: 'https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@300;400;500;600&display=swap',
}

function ensureSkinFont(skin: AppSkin): void {
  const href = SKIN_FONTS[skin]
  if (!href || typeof document === 'undefined') return
  if (document.querySelector(`link[data-skin-font="${skin}"]`)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  link.dataset.skinFont = skin
  document.head.appendChild(link)
}

export function applySkin(skin: AppSkin): void {
  document.documentElement.dataset.skin = skin
  ensureSkinFont(skin)
}

/** Hide-key an admin ticks (Admin → Users → hidden buttons) to stop a user from picking this skin. */
export function skinHideId(skin: AppSkin): string {
  return `skin.${skin}`
}

/** Skins this user may pick. Classic is always allowed, so nobody is ever left without a look. */
export function allowedSkins(hiddenSidebar: readonly string[] | null | undefined): AppSkin[] {
  const hidden = new Set(hiddenSidebar ?? [])
  return SKIN_IDS.filter(id => id === 'classic' || !hidden.has(skinHideId(id)))
}

/** The skin to actually show: the saved choice when still allowed, otherwise Classic. */
export function effectiveSkin(saved: AppSkin, hiddenSidebar: readonly string[] | null | undefined): AppSkin {
  return allowedSkins(hiddenSidebar).includes(saved) ? saved : DEFAULT_SKIN
}
