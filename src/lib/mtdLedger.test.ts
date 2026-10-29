import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
const from = vi.fn()
vi.mock('./supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (...a: unknown[]) => from(...a) } }))

import {
  MTD_LEDGER_PAGE,
  fetchMtdInvoiceLines,
  fetchMtdInvoices,
  fetchMtdLedger,
  invoiceKey,
  parseLedgerInvoices,
  parseLedgerLines,
  parseLedgerPage,
} from './mtdLedger'

beforeEach(() => {
  rpc.mockReset()
  from.mockReset()
})

describe('parseLedgerPage', () => {
  it('normalises numbers, keeps missing debt as null', () => {
    const p = parseLedgerPage({
      total: '2',
      rows: [
        { clientID: 7, clientName: 'A', cash: '10.5', docs: 2, debt: null },
        { clientID: '8', clientName: null, cash: 'x', docs: 1, debt: '3' },
      ],
    })
    expect(p.total).toBe(2)
    expect(p.rows[0]).toEqual({ clientID: '7', clientName: 'A', cash: 10.5, docs: 2, debt: null })
    expect(p.rows[1]).toEqual({ clientID: '8', clientName: '', cash: 0, docs: 1, debt: 3 })
  })
  it('survives a null or broken payload (what the database returns for a user with no access)', () => {
    expect(parseLedgerPage(null)).toEqual({ total: 0, rows: [] })
    expect(parseLedgerPage({ rows: 'x' })).toEqual({ total: 0, rows: [] })
    expect(parseLedgerInvoices(null)).toEqual([])
    expect(parseLedgerLines({})).toEqual([])
  })
})

describe('invoices and lines', () => {
  it('keys an invoice by type and number together', () => {
    expect(invoiceKey({ docType: '11', docNum: '5' })).not.toBe(invoiceKey({ docType: '14', docNum: '5' }))
  })
  it('keeps a null unit price when qty is zero', () => {
    const [l] = parseLedgerLines([{ itemSKU: 'A', itemName: 'x', qty: 0, cash: 0, price: null }])
    expect(l.price).toBeNull()
  })
})

describe('fetchers go through the scoped database functions only', () => {
  it('ledger: passes company, paging, trimmed query and the previewed user', async () => {
    rpc.mockResolvedValue({ data: { total: 0, rows: [] }, error: null })
    await fetchMtdLedger('pupik', '  abc ', 50, 'user-1')
    expect(rpc).toHaveBeenCalledWith('get_mtd_client_ledger', {
      p_company: 'pupik',
      p_query: 'abc',
      p_limit: MTD_LEDGER_PAGE,
      p_offset: 50,
      p_as: 'user-1',
    })
    expect(from).not.toHaveBeenCalled()
  })
  it('sends p_as null when not previewing', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    await fetchMtdInvoices('mt', '123')
    await fetchMtdInvoiceLines('mt', '123', '11', '9')
    expect(rpc).toHaveBeenNthCalledWith(1, 'get_mtd_client_invoices', { p_company: 'mt', p_client_id: '123', p_as: null })
    expect(rpc).toHaveBeenNthCalledWith(2, 'get_mtd_invoice_lines', {
      p_company: 'mt', p_client_id: '123', p_doc_type: '11', p_doc_num: '9', p_as: null,
    })
    expect(from).not.toHaveBeenCalled()
  })
  it('surfaces database errors', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('boom') })
    await expect(fetchMtdLedger('pupik', '', 0)).rejects.toThrow('boom')
  })
})

describe('migration enforces scope in the database', () => {
  it('every function uses the gate, the agent filter and the rep891 current-month filter', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const sql = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/20261029100300_mtd_client_ledger.sql'), 'utf8')
    const bodies = sql.split('create or replace function').slice(1)
    expect(bodies).toHaveLength(4)
    for (const b of bodies.filter(x => !x.includes('mtd_ledger_gate(p_company text'))) {
      expect(b).toContain('mtd_ledger_gate(p_company, p_as)')
      expect(b).toContain('s.agent_erp_id = any(acc.agents)')
      expect(b).toContain("s.line_source ilike 'rep891%'")
      expect(b).toContain('s.year = cur_y and s.month = cur_m')
      expect(b).toContain('security definer')
      expect(b).toMatch(/revoke all on function public\.get_mtd_\w+\([^)]*\) from public, anon;/)
    }
    // the gate honours p_as only for a super admin and is not callable by clients
    expect(sql).toContain('previewing := p_as is not null and p_as <> auth.uid() and is_super_admin();')
    expect(sql).toContain('revoke all on function public.mtd_ledger_gate(text, uuid) from public, anon, authenticated;')
  })
})
