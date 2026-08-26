import { useQuery } from '@tanstack/react-query'
import { useLocale } from '../../../context/LocaleContext'
import { fmt } from '../../../lib/format'
import { supabase } from '../../../lib/supabase'
import type { LogicalCompany } from '../../../types/dashboard'

/** Receipts amounts arrive gross (008 report, incl. 18% VAT). */
const VAT_RATE = 1.18

export interface ReceiptMtdClientRow {
  clientID: string
  clientName: string
  cash_gross: number
}

export interface SmReceiptsReportModalProps {
  title: string
  company: LogicalCompany
  /** null / empty = all agents in the user's access for that company */
  agents: string[] | null
  onClose: () => void
}

async function fetchReceiptsMtdByClient(
  company: LogicalCompany,
  agents: string[] | null,
): Promise<ReceiptMtdClientRow[]> {
  const { data, error } = await supabase.rpc('get_receipts_mtd_by_client', {
    p_company: company,
    p_agents: agents && agents.length > 0 ? agents : null,
  })
  if (error) throw error
  const rows = (data ?? []) as ReceiptMtdClientRow[]
  return rows.map(r => ({
    clientID: String(r.clientID ?? ''),
    clientName: String(r.clientName ?? ''),
    cash_gross: Number(r.cash_gross) || 0,
  }))
}

/** Full receipts report: current month by client (net of VAT). */
export function SmReceiptsReportModal({ title, company, agents, onClose }: SmReceiptsReportModalProps) {
  const { t } = useLocale()
  const agentKey = agents && agents.length > 0 ? agents.slice().sort().join(',') : 'all'
  const q = useQuery({
    queryKey: ['receipts-mtd-by-client', company, agentKey],
    queryFn: () => fetchReceiptsMtdByClient(company, agents),
  })

  const rows = q.data ?? []
  const grandNet = rows.reduce((s, r) => s + r.cash_gross / VAT_RATE, 0)

  return (
    <div className="debt-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="debt-modal sm-receipts-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="debt-modal-hdr">
          <span>{title}</span>
          <button type="button" className="debt-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="debt-modal-body">
          <p className="sm-report-hint">
            {t('sm.receipts.mtdTitle')} · {t('oversite.receiptsNetNote')}
          </p>
          {q.isLoading ? (
            <p className="ov-empty">{t('sm.receipts.mtdLoading')}</p>
          ) : q.isError ? (
            <p className="status-msg error">{(q.error as Error).message}</p>
          ) : rows.length === 0 ? (
            <p className="ov-empty">{t('sm.receipts.mtdEmpty')}</p>
          ) : (
            <div className="tw">
              <table className="ov-orders-table sm-receipts-table">
                <thead>
                  <tr>
                    <th>{t('sm.receipts.colClientId')}</th>
                    <th>{t('sm.receipts.colClient')}</th>
                    <th className="cm">{t('sm.receipts.colCash')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.clientID}>
                      <td className="bi-mono">{r.clientID}</td>
                      <td>{r.clientName || '—'}</td>
                      <td className="cm">{fmt(r.cash_gross / VAT_RATE)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>
                      <b>{t('oversite.orderTotal')}</b>
                    </td>
                    <td className="cm">
                      <b>{fmt(grandNet)}</b>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
