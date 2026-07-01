/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_DASHBOARD_DATA_URL: string
  readonly VITE_DASHBOARD_DATA_URL_DEV?: string
  /** 'false' forces the legacy data_loader.js blob; anything else uses Supabase. */
  readonly VITE_USE_SUPABASE_DATA?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
