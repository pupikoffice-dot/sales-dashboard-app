import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from '../../context/LocaleContext'
import { usePreview } from '../../context/PreviewContext'
import { fmt, fmtDateIso } from '../../lib/format'
import {
  MTD_LEDGER_PAGE,
  fetchMtdInvoiceLines,
  fetchMtdInvoices,
  fetchMtdLedger,
  invoiceKey,
  type MtdLedgerClient,
  type MtdLedgerInvoice,
} from '../../lib/mtdLedger'
import type { LogicalCompany } from '../../types/dashboard'

/**
 * Sales MTD extended report for the signed-in user (every role): clients with their cash, click a client for its
 * invoices, click an invoice for its lines. Nothing loads until the dropdown is opened, then each level loads only
 * when expanded. The database decides what the user may see; "View as" passes the previewed user so a super admin
 * sees exactly that user's scope.
 */
export function MtdClientLedger({ company }: { company: LogicalCompany }) {
  const { t } = useLocale()
  const { isPreviewing, previewUser } = usePreview()
  const asUser = isPreviewing ? (previewUser?.id ?? null) : null
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [pages, setPages] = useState(1)

  // Debounce the search box; a new search or a changed viewer starts over at page one.
  useEffect(() => {
    const id = setTimeout(() => setQuery(search), 300)
    return () => clearTimeout(id)
  }, [search])
  useEffect(() => setPages(1), [query, company, asUser])

  const limit = pages * MTD_LEDGER_PAGE
  const q = useQuery({
    queryKey: ['mtd-ledger', company, query, limit, asUser],
    queryFn: async () => {
      // Pages are fetched cumulatively (offset 0..limit) so "show more" keeps earlier rows without extra state.
      const out = await Promise.all(
        Array.from({ length: pages }, (_, i) => fetchMtdLedger(company, query, i * MTD_LEDGER_PAGE, asUser)),
      )
      return { total: out[0]?.total ?? 0, rows: out.flatMap(p => p.rows) }
    },
    enabled: open,
    staleTime: 60_000,
    placeholderData: prev => prev,
  })
  const rows = q.data?.rows ?? []
  const total = q.data?.total ?? 0

  return (
    <div className="mtdl">
      <button
        type="button"
        className="ov-toggle-btn"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        📒 {t('mtdLedger.title')} {open ? '▴' : '▾'}
      </button>
      {open ? (
        <div className="ov-drop mtdl-body">
          <input
            type="search"
            className="mtdl-search"
            value={search}
            placeholder={t('mtdLedger.search')}
            aria-label={t('mtdLedger.search')}
            onChange={e => setSearch(e.target.value)}
          />
          <p className="sm-report-hint">{t('mtdLedger.hint')}</p>
          {q.isLoading ? <p className="ov-empty">{t('mtdLedger.loading')}</p> : null}
          {q.error ? <p className="status-msg error">{(q.error as Error).message}</p> : null}
          {!q.isLoading && !q.error && rows.length === 0 ? <p className="ov-empty">{t('mtdLedger.empty')}</p> : null}
          {rows.length > 0 ? (
            <div className="tw">
              <table className="ov-orders-table mtdl-table">
                <thead>
                  <tr>
                    <th aria-hidden="true" className="mtdl-chev" />
                    <th>{t('mtdLedger.clientNo')}</th>
                    <th>{t('mtdLedger.clientName')}</th>
                    <th className="mtdl-num">{t('oversite.cash')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(c => (
                    <ClientRows key={c.clientID} company={company} client={c} asUser={asUser} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {rows.length > 0 ? (
            <div className="mtdl-foot">
              <span>{t('mtdLedger.shown', { shown: String(rows.length), total: String(total) })}</span>
              {rows.length < total ? (
                <button type="button" className="ov-toggle-btn mtdl-more" onClick={() => setPages(p => p + 1)}>
                  {t('mtdLedger.more')}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function ClientRows({ company, client, asUser }: { company: LogicalCompany; client: MtdLedgerClient; asUser: string | null }) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const inv = useQuery({
    queryKey: ['mtd-ledger-invoices', company, client.clientID, asUser],
    queryFn: () => fetchMtdInvoices(company, client.clientID, asUser),
    enabled: open,
    staleTime: 60_000,
  })
  return (
    <>
      <tr
        className="ov-order-row"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen(v => !v)
          }
        }}
      >
        <td className="mtdl-chev">{open ? '▾' : '▸'}</td>
        <td className="cm">{client.clientID}</td>
        <td>{client.clientName || '—'}</td>
        <td className="mtdl-num">{fmt(client.cash)}</td>
      </tr>
      {open ? (
        <tr className="mtdl-sub">
          <td colSpan={4}>
            {client.debt != null && client.debt !== 0 ? (
              <p className="sm-report-hint">{t('mtdLedger.openDebt', { amount: fmt(client.debt) })}</p>
            ) : null}
            {inv.isLoading ? <p className="ov-empty">{t('mtdLedger.loading')}</p> : null}
            {inv.error ? <p className="status-msg error">{(inv.error as Error).message}</p> : null}
            {inv.data && inv.data.length === 0 ? <p className="ov-empty">{t('mtdLedger.noInvoices')}</p> : null}
            {inv.data && inv.data.length > 0 ? (
              <div className="tw">
                <table className="ov-orders-table mtdl-inv">
                  <thead>
                    <tr>
                      <th aria-hidden="true" className="mtdl-chev" />
                      <th>{t('mtdLedger.invoiceNo')}</th>
                      <th>{t('mtdLedger.docType')}</th>
                      <th>{t('oversite.orderDate')}</th>
                      <th className="mtdl-num">{t('oversite.qty')}</th>
                      <th className="mtdl-num">{t('mtdLedger.amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inv.data.map(i => (
                      <InvoiceRows key={invoiceKey(i)} company={company} clientId={client.clientID} invoice={i} asUser={asUser} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  )
}

function InvoiceRows({
  company,
  clientId,
  invoice,
  asUser,
}: {
  company: LogicalCompany
  clientId: string
  invoice: MtdLedgerInvoice
  asUser: string | null
}) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const lines = useQuery({
    queryKey: ['mtd-ledger-lines', company, clientId, invoice.docType, invoice.docNum, asUser],
    queryFn: () => fetchMtdInvoiceLines(company, clientId, invoice.docType, invoice.docNum, asUser),
    enabled: open,
    staleTime: 60_000,
  })
  return (
    <>
      <tr
        className="ov-order-row"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen(v => !v)
          }
        }}
      >
        <td className="mtdl-chev">{open ? '▾' : '▸'}</td>
        <td className="cm">{invoice.docNum || '—'}</td>
        <td className="cm">{invoice.docType || '—'}</td>
        <td className="cm">{fmtDateIso(invoice.date)}</td>
        <td className="mtdl-num">{fmt(invoice.qty)}</td>
        <td className="mtdl-num">{fmt(invoice.cash)}</td>
      </tr>
      {open ? (
        <tr className="mtdl-sub">
          <td colSpan={6}>
            {lines.isLoading ? <p className="ov-empty">{t('mtdLedger.loading')}</p> : null}
            {lines.error ? <p className="status-msg error">{(lines.error as Error).message}</p> : null}
            {lines.data && lines.data.length === 0 ? <p className="ov-empty">{t('mtdLedger.noLines')}</p> : null}
            {lines.data && lines.data.length > 0 ? (
              <div className="tw">
                <table className="ov-orders-table mtdl-lines">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>{t('oversite.orderItem')}</th>
                      <th className="mtdl-num">{t('oversite.qty')}</th>
                      <th className="mtdl-num">{t('mtdLedger.price')}</th>
                      <th className="mtdl-num">{t('mtdLedger.lineTotal')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.data.map((l, idx) => (
                      <tr key={`${l.itemSKU}-${idx}`}>
                        <td className="cm">{l.itemSKU || '—'}</td>
                        <td>{l.itemName || '—'}</td>
                        <td className="mtdl-num">{fmt(l.qty)}</td>
                        <td className="mtdl-num">{l.price == null ? '—' : fmt(l.price)}</td>
                        <td className="mtdl-num">{fmt(l.cash)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4}>
                        <b>{t('oversite.total')}</b>
                      </td>
                      <td className="mtdl-num">
                        <b>{fmt(lines.data.reduce((s, l) => s + l.cash, 0))}</b>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  )
}
