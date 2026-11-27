import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DealsPerRangeView } from '../../components/rnd/DealsPerRangeView'
import { PlanHeader } from '../../components/rnd/PlanHeader'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { useLocale } from '../../context/LocaleContext'
import { usePreview } from '../../context/PreviewContext'
import { DEAL_RANGES, fetchDealsDetail, fetchDealsPerRange } from '../../lib/dealsPerRange'
import { fmt0, fmtDateIso } from '../../lib/format'
import type { LogicalCompany } from '../../types/dashboard'
import './SalesSpecificsPage.css'

const COMPANY_ORDER: LogicalCompany[] = ['pupik', 'mt', 'gold']

interface Picked {
  bucket: number
  period: string
  periodLabel: string
}

/** The invoices counted in one cell of the table. */
function DealsModal({ company, picked, asUser, onClose }: { company: LogicalCompany; picked: Picked; asUser: string | null; onClose: () => void }) {
  const { t } = useLocale()
  const q = useQuery({
    queryKey: ['deals-detail', company, picked.bucket, picked.period, asUser],
    queryFn: () => fetchDealsDetail(company, picked.bucket, picked.period, asUser),
    staleTime: 5 * 60 * 1000,
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const range = DEAL_RANGES.find(r => r.bucket === picked.bucket)?.label ?? ''
  const rows = q.data?.rows ?? []
  const sum = rows.reduce((a, r) => a + r.total, 0)
  return (
    <div className="debt-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="debt-modal" style={{ maxWidth: 900 }} role="dialog" aria-modal="true" aria-label={`${range} · ${picked.periodLabel}`}>
        <div className="debt-modal-hdr">
          <span>
            {t('ss.detail.title')}: {range} · {picked.periodLabel}
          </span>
          <div className="debt-modal-hdr-actions">
            <button type="button" className="debt-modal-close" onClick={onClose}>
              {t('oc.close')} ✕
            </button>
          </div>
        </div>
        <div className="debt-modal-body">
          {q.isLoading ? <p className="status-msg">{t('oc.loading')}</p> : null}
          {q.error ? <p className="status-msg error">{(q.error as Error).message}</p> : null}
          {q.data ? (
            <>
              <p style={{ margin: '0 0 8px' }}>
                {t('ss.detail.count', { n: fmt0(q.data.total), sum: fmt0(sum) })}
                {q.data.total > rows.length ? ` · ${t('ss.detail.limited', { n: fmt0(rows.length) })}` : ''}
              </p>
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>{t('ss.col.date')}</th>
                      <th>{t('ss.col.doc')}</th>
                      <th style={{ textAlign: 'start' }}>{t('ss.col.client')}</th>
                      <th>{t('ss.col.lines')}</th>
                      <th>{t('ss.col.total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={`${r.docType}|${r.docNum}`}>
                        <td>{fmtDateIso(r.date)}</td>
                        <td>
                          {r.docType}/{r.docNum}
                        </td>
                        <td style={{ textAlign: 'start' }}>
                          {r.clientName ?? ''} <small style={{ opacity: 0.6 }}>{r.clientID ?? ''}</small>
                        </td>
                        <td>{r.lines}</td>
                        <td>{fmt0(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}


/** R&D → Sales specifics: Deals per Range (invoices issued, positive totals only) by invoice-total range and period. */
export function SalesSpecificsPage() {
  const { t } = useLocale()
  const { access } = useDashboardAccess()
  const { isPreviewing, previewUser } = usePreview()
  const asUser = isPreviewing ? (previewUser?.id ?? null) : null
  const companies = useMemo(() => COMPANY_ORDER.filter(c => access?.companies.includes(c)), [access?.companies])
  const [pickedCo, setPickedCo] = useState<LogicalCompany | null>(null)
  const company = (pickedCo && companies.includes(pickedCo) ? pickedCo : companies[0]) as LogicalCompany | undefined
  const [picked, setPicked] = useState<Picked | null>(null)

  const q = useQuery({
    queryKey: ['deals-per-range', company, asUser],
    queryFn: () => fetchDealsPerRange(company as string, asUser),
    enabled: !!company,
    staleTime: 5 * 60 * 1000,
  })

  if (!company) return <p className="status-msg">{t('oc.noData')}</p>

  return (
    <div className="panel" style={{ padding: 16 }}>
      <PlanHeader title={t('ss.title')} companyLabelText={t('oc.company')} companies={companies} company={company} onCompany={setPickedCo} buttons={[]} />
      <h3 style={{ margin: '4px 0' }}>{t('ss.deals.title')}</h3>
      <p style={{ opacity: 0.8, maxWidth: 900 }}>{t('ss.deals.intro')}</p>
      {q.isLoading ? <p className="status-msg">{t('oc.loading')}</p> : null}
      {q.error ? <p className="status-msg error">{(q.error as Error).message}</p> : null}
      {q.data === null ? <p className="status-msg">{t('oc.noData')}</p> : null}
      {q.data ? (
        <DealsPerRangeView
          data={q.data}
          csvName={`deals_per_range_${company}`}
          onCell={(bucket, period, periodLabel) => setPicked({ bucket, period, periodLabel })}
        />
      ) : null}
      {picked ? <DealsModal company={company} picked={picked} asUser={asUser} onClose={() => setPicked(null)} /> : null}
    </div>
  )
}
