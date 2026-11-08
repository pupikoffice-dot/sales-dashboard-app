import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { SortTh, useSortedRows } from './sortRows'
import { useLocale } from '../../context/LocaleContext'
import { downloadCSV } from '../../lib/csvExport'
import { fmtDate } from '../../lib/dates'
import { fmt0 } from '../../lib/format'
import { fetchReturnsDetail } from '../../lib/purchaseCards'

type Target = { clientId: string } | { sku: string }

/**
 * Expandable "what are the returns made of" table for the client card and the item card: the credit lines behind the return
 * figure of the last 12 months (same rule as the figure itself), with the reason from the 855 returns report where it is known.
 * On a client card the lines show the item; on an item card they show the client.
 */
export function ReturnsDetail({ company, target, asUser }: { company: string; target: Target; asUser: string | null }) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const isClient = 'clientId' in target
  const key = isClient ? target.clientId : target.sku
  const res = useQuery({
    queryKey: ['returns-detail', company, key, asUser],
    queryFn: () => fetchReturnsDetail(company, target, asUser),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })
  const data = res.data
  const reasonLabel = (code: string | null, text: string | null) => (code == null && !text ? t('pc.ret.noReason') : [code, text].filter(Boolean).join(' · '))
  const reasonRows = useMemo(() => (data?.reasons ?? []).map(r => ({ ...r, label: reasonLabel(r.code, r.text) })), [data]) // eslint-disable-line react-hooks/exhaustive-deps
  const reasonSort = useSortedRows(
    reasonRows,
    { reason: r => r.label, qty: r => r.qty, cash: r => r.cash, lines: r => r.lines },
    { key: 'cash', dir: 'desc' },
    ['reason'],
  )
  const lineSort = useSortedRows(
    data?.rows,
    { date: r => r.date, doc: r => r.docNum, who: r => (isClient ? `${r.sku} ${r.name}` : r.client), qty: r => r.qty, cash: r => r.cash, reason: r => reasonLabel(r.code, r.reason) },
    { key: 'date', dir: 'desc' },
    ['doc', 'who', 'reason'],
  )

  function exportCsv() {
    if (!data) return
    const head = [t('pc.col.date'), t('pc.col.document'), isClient ? t('pc.col.item') : t('pc.col.client'), t('pc.col.pieces'), t('pc.col.cash'), t('pc.col.reason')]
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const body = lineSort.sorted.map(r =>
      [fmtDate(r.date), r.docNum, isClient ? `${r.sku} ${r.name}` : `${r.client} (${r.clientID})`, r.qty, r.cash, reasonLabel(r.code, r.reason)].map(esc).join(','),
    )
    downloadCSV([head.map(esc).join(','), ...body].join('\n'), `returns_${key.replace(/\W+/g, '_')}.csv`)
  }

  return (
    <section className="hub-card hub-span-12">
      <div className="hub-card-hdr">
        <h3>{t('pc.ret.title')}</h3>
        <button type="button" className="chip" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          {open ? t('pc.ret.hide') : t('pc.ret.show')}
        </button>
      </div>
      {!open ? null : res.isLoading ? (
        <p className="status-msg">{t('common.loading')}</p>
      ) : res.error ? (
        <p className="status-msg error">{(res.error as Error).message}</p>
      ) : !data || !data.lines ? (
        <p className="status-msg">{t('pc.ret.empty')}</p>
      ) : (
        <>
          <p className="sel-months-list" style={{ margin: '0 0 8px' }}>
            {t('pc.ret.summary', { lines: fmt0(data.lines), qty: fmt0(data.qty), cash: fmt0(data.cash) })}
            {' · '}
            {t('pc.ret.reasonKnownN', { n: fmt0(data.withReason), total: fmt0(data.lines) })}
          </p>

          <h4 style={{ margin: '8px 0 4px' }}>{t('pc.ret.byReason')}</h4>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <SortTh label={t('pc.col.reason')} k="reason" left sort={reasonSort.sort} onSort={reasonSort.onSort} />
                  <SortTh label={t('pc.col.pieces')} k="qty" sort={reasonSort.sort} onSort={reasonSort.onSort} />
                  <SortTh label={t('pc.col.cash')} k="cash" sort={reasonSort.sort} onSort={reasonSort.onSort} />
                  <SortTh label={t('pc.col.lines')} k="lines" sort={reasonSort.sort} onSort={reasonSort.onSort} />
                </tr>
              </thead>
              <tbody>
                {reasonSort.sorted.map(r => (
                  <tr key={r.code ?? 'none'}>
                    <td style={{ textAlign: 'left' }}>{r.label}</td>
                    <td>{fmt0(r.qty)}</td>
                    <td>{fmt0(r.cash)}</td>
                    <td>{fmt0(r.lines)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4 style={{ margin: '12px 0 4px' }}>{t('pc.ret.lines')}</h4>
          <div className="dl-bar">
            <button type="button" className="dl-btn" onClick={exportCsv}>
              {t('pc.ret.export')}
            </button>
          </div>
          {data.lines > data.rows.length ? (
            <p className="status-msg">{t('pc.ret.truncated', { n: fmt0(data.rows.length), total: fmt0(data.lines) })}</p>
          ) : null}
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <SortTh label={t('pc.col.date')} k="date" left sort={lineSort.sort} onSort={lineSort.onSort} />
                  <SortTh label={t('pc.col.document')} k="doc" left sort={lineSort.sort} onSort={lineSort.onSort} />
                  <SortTh label={isClient ? t('pc.col.item') : t('pc.col.client')} k="who" left sort={lineSort.sort} onSort={lineSort.onSort} />
                  <SortTh label={t('pc.col.pieces')} k="qty" sort={lineSort.sort} onSort={lineSort.onSort} />
                  <SortTh label={t('pc.col.cash')} k="cash" sort={lineSort.sort} onSort={lineSort.onSort} />
                  <SortTh label={t('pc.col.reason')} k="reason" left sort={lineSort.sort} onSort={lineSort.onSort} />
                </tr>
              </thead>
              <tbody>
                {lineSort.sorted.map((r, i) => (
                  <tr key={`${r.date}|${r.docNum}|${r.sku}|${r.clientID}|${i}`}>
                    <td style={{ textAlign: 'left' }}>{fmtDate(r.date)}</td>
                    <td style={{ textAlign: 'left' }}>{r.docNum || '—'}</td>
                    <td style={{ textAlign: 'left' }} title={isClient ? r.name : r.client}>
                      {isClient ? (
                        <>
                          <Link to={`/rnd/item?co=${company}&sku=${encodeURIComponent(r.sku)}`}>{r.sku}</Link> · {r.name}
                        </>
                      ) : (
                        <>
                          <Link to={`/rnd/client?co=${company}&id=${encodeURIComponent(r.clientID)}`}>{r.client || r.clientID}</Link> <small>{r.clientID}</small>
                        </>
                      )}
                    </td>
                    <td>{fmt0(r.qty)}</td>
                    <td>{fmt0(r.cash)}</td>
                    <td style={{ textAlign: 'left' }}>{r.code || r.reason ? reasonLabel(r.code, r.reason) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
