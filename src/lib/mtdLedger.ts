import { supabase } from './supabase'

/**
 * Sales MTD extended report: clients -> invoices -> invoice lines.
 *
 * All scoping (companies, agents, hidden years, current month, rep891 lines) happens in the database functions
 * get_mtd_client_ledger / get_mtd_client_invoices / get_mtd_invoice_lines. This module never reads a table directly.
 * `asUser` is the user being previewed ("View as"); the database honours it only for a real super admin.
 */

export const MTD_LEDGER_PAGE = 50

export interface MtdLedgerClient {
  clientID: string
  clientName: string
  cash: number
  docs: number
  /** Open debt from the debts report, same company/agent scope. null = none on file. */
  debt: number | null
}

export interface MtdLedgerPage {
  total: number
  rows: MtdLedgerClient[]
}

export interface MtdLedgerInvoice {
  docNum: string
  docType: string
  /** YYYY-MM-DD */
  date: string
  agent: string
  lines: number
  qty: number
  cash: number
}

export interface MtdLedgerLine {
  itemSKU: string
  itemName: string
  qty: number
  cash: number
  /** Unit price = line total / qty; null when qty is 0. */
  price: number | null
}

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const str = (v: unknown): string => (v == null ? '' : String(v))

export function parseLedgerPage(raw: unknown): MtdLedgerPage {
  const o = (raw ?? {}) as { total?: unknown; rows?: unknown }
  const rows = Array.isArray(o.rows) ? o.rows : []
  return {
    total: num(o.total),
    rows: rows.map((r: Record<string, unknown>) => ({
      clientID: str(r.clientID),
      clientName: str(r.clientName),
      cash: num(r.cash),
      docs: num(r.docs),
      debt: r.debt == null ? null : num(r.debt),
    })),
  }
}

export function parseLedgerInvoices(raw: unknown): MtdLedgerInvoice[] {
  if (!Array.isArray(raw)) return []
  return raw.map((r: Record<string, unknown>) => ({
    docNum: str(r.docNum),
    docType: str(r.docType),
    date: str(r.date),
    agent: str(r.agent),
    lines: num(r.lines),
    qty: num(r.qty),
    cash: num(r.cash),
  }))
}

export function parseLedgerLines(raw: unknown): MtdLedgerLine[] {
  if (!Array.isArray(raw)) return []
  return raw.map((r: Record<string, unknown>) => ({
    itemSKU: str(r.itemSKU),
    itemName: str(r.itemName),
    qty: num(r.qty),
    cash: num(r.cash),
    price: r.price == null ? null : num(r.price),
  }))
}

/** Stable key for one invoice (document type + number are only unique together). */
export const invoiceKey = (inv: Pick<MtdLedgerInvoice, 'docType' | 'docNum'>): string => `${inv.docType}/${inv.docNum}`

export async function fetchMtdLedger(
  company: string,
  query: string,
  offset: number,
  asUser?: string | null,
): Promise<MtdLedgerPage> {
  const { data, error } = await supabase.rpc('get_mtd_client_ledger', {
    p_company: company,
    p_query: query.trim() || null,
    p_limit: MTD_LEDGER_PAGE,
    p_offset: offset,
    p_as: asUser ?? null,
  })
  if (error) throw error
  return parseLedgerPage(data)
}

export async function fetchMtdInvoices(
  company: string,
  clientId: string,
  asUser?: string | null,
): Promise<MtdLedgerInvoice[]> {
  const { data, error } = await supabase.rpc('get_mtd_client_invoices', {
    p_company: company,
    p_client_id: clientId,
    p_as: asUser ?? null,
  })
  if (error) throw error
  return parseLedgerInvoices(data)
}

export async function fetchMtdInvoiceLines(
  company: string,
  clientId: string,
  docType: string,
  docNum: string,
  asUser?: string | null,
): Promise<MtdLedgerLine[]> {
  const { data, error } = await supabase.rpc('get_mtd_invoice_lines', {
    p_company: company,
    p_client_id: clientId,
    p_doc_type: docType,
    p_doc_num: docNum,
    p_as: asUser ?? null,
  })
  if (error) throw error
  return parseLedgerLines(data)
}
