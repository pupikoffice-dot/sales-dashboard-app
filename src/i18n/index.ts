import { messages as en } from './en'
import { messages as he } from './he'
import type { AppLocale } from './types'
import type { MessageKey } from './types'

const catalogs: Record<AppLocale, Record<MessageKey, string>> = { en, he }

const MONTH_KEYS: MessageKey[] = [
  'month.jan', 'month.feb', 'month.mar', 'month.apr', 'month.may', 'month.jun',
  'month.jul', 'month.aug', 'month.sep', 'month.oct', 'month.nov', 'month.dec',
]

export function isAppLocale(value: string): value is AppLocale {
  return value === 'en' || value === 'he'
}

export function localeDir(locale: AppLocale): 'ltr' | 'rtl' {
  return locale === 'he' ? 'rtl' : 'ltr'
}

export function createTranslator(locale: AppLocale) {
  const dict = catalogs[locale] ?? en
  return function t(key: MessageKey, vars?: Record<string, string | number>): string {
    let text = dict[key] ?? en[key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replaceAll(`{${k}}`, String(v))
      }
    }
    return text
  }
}

export function monthNamesForLocale(locale: AppLocale): string[] {
  const t = createTranslator(locale)
  return MONTH_KEYS.map(k => t(k))
}

const NAV_KEYS: Record<string, MessageKey> = {
  oversite: 'nav.oversite',
  sales_performance: 'nav.sales',
  orders_mtd: 'nav.ordersMtd',
  open_orders: 'nav.openOrders',
  returns: 'nav.returns',
  debt: 'nav.debt',
  stock_alerts: 'nav.stockAlerts',
  stock: 'nav.stock',
  export: 'nav.export',
}

export function navLabel(locale: AppLocale, moduleId: string): string {
  const t = createTranslator(locale)
  const key = NAV_KEYS[moduleId]
  return key ? t(key) : moduleId
}
