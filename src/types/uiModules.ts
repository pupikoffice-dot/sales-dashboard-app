export type UiModuleSurface = 'oversight' | 'sidebar'
export type UiModuleKind = 'suite' | 'addon'

/** Catalog / grant row used for Oversight layout resolution. */
export interface UiModuleRef {
  id: string
  surface: UiModuleSurface
  kind: UiModuleKind
}

/** Full catalog row from `app_ui_module`. */
export interface AppUiModule {
  id: string
  label: string
  surface: UiModuleSurface
  kind: UiModuleKind
  active: boolean
  sortOrder: number
  description: string | null
}

/** Parsed grant key: `ui.<surface>.<kind>.<id>`. */
export interface UiModuleGrantKeyParts {
  surface: UiModuleSurface
  kind: UiModuleKind
  id: string
}

export type OversightMode =
  | { mode: 'suite'; suiteId: string }
  | { mode: 'classic'; addonIds: string[] }
