export type UiModuleSurface = 'oversight' | 'sidebar'
export type UiModuleKind = 'suite' | 'addon'

/** Catalog / grant row used for Oversight layout resolution. */
export interface UiModuleRef {
  id: string
  surface: UiModuleSurface
  kind: UiModuleKind
}

export type OversightMode =
  | { mode: 'suite'; suiteId: string }
  | { mode: 'classic'; addonIds: string[] }
