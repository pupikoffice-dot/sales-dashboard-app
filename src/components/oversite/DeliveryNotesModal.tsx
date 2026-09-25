import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocale } from '../../context/LocaleContext'
import { fmt } from '../../lib/format'
import {
  formatOrderDateDisp,
  type Delivery720Metrics,
  type OrderTodayGroup,
} from '../../lib/oversiteMetrics'
import { OversiteKpiRow } from './OversiteKpiRow'

export interface DeliveryNotesModalProps {
  title: string
  metrics: Delivery720Metrics
  /** Report 720 MTD documents, newest first. */
  docs: OrderTodayGroup[]
  onClose: () => void
}

/**
 * Report 720 MTD — list of delivery note documents; selecting one shows its lines.
 * Opened from the Sales MTD card (classic + suite).
 */
export function DeliveryNotesModal({ title, metrics, docs, onClose }: DeliveryNotesModalProps) {
  const { t } = useLocale()
  const [openKey, setOpenKey] = useState<string | null>(null)
  const openDoc = openKey ? docs.find(d => d.key === openKey) ?? null : null
  const showClient = useMemo(() => docs.some(d => d.clientName), [docs])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (openKey) setOpenKey(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, openKey])

  const headerTitle = openDoc
    ? `${title} · ${t('oversite.deliveryDocTitle', { doc: openDoc.docNum })}`
    : title

  // Portal: the trigger lives inside suite cubes / arrange chrome, which can create
  // containing blocks that break `position: fixed` overlays.
  return createPortal(
    <div className="debt-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sm-items-modal" role="dialog" aria-modal="true" aria-label={headerTitle}>
        <div className="debt-modal-hdr">
          <span>{headerTitle}</span>
          <button type="button" className="debt-modal-close" onClick={onClose} autoFocus>
            ✕
          </button>
        </div>
        <div className="sm-items-modal-body">
          {openDoc ? (
            <DeliveryDocDetail doc={openDoc} onBack={() => setOpenKey(null)} />
          ) : (
            <>
              <OversiteKpiRow
                kpis={[
                  { label: t('oversite.clients'), value: String(metrics.clients) },
                  { label: t('oversite.qty'), value: fmt(metrics.qty) },
                  { label: t('oversite.cash'), value: fmt(metrics.cash), tone: 'grn' },
                ]}
              />
              {docs.length === 0 ? (
                <p className="ov-empty">{t('oversite.noDeliveryNotes')}</p>
              ) : (
                <>
                  <p className="sm-report-hint delivery-modal-subhdr">
                    {t('oversite.deliveryDocsCount', { count: String(docs.length) })}
                  </p>
                  <div className="tw">
                    <table className="ov-orders-table delivery-docs-table">
                      <thead>
                        <tr>
                          <th>{t('oversite.deliveryDocNumber')}</th>
                          <th>{t('oversite.orderDate')}</th>
                          <th>{t('oversite.debtAgent')}</th>
                          {showClient ? <th>{t('oversite.orderClientName')}</th> : null}
                          <th className="delivery-col-lines">{t('oversite.deliveryDocLines')}</th>
                          <th>{t('oversite.qty')}</th>
                          <th>{t('oversite.orderTotal')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {docs.map(doc => (
                          <tr
                            key={doc.key}
                            className="ov-order-row"
                            tabIndex={0}
                            onClick={() => setOpenKey(doc.key)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                setOpenKey(doc.key)
                              }
                            }}
                          >
                            <td className="cm delivery-doc-link">{doc.docNum}</td>
                            <td className="cm">{formatOrderDateDisp(doc.orderDate)}</td>
                            <td className="cm">{doc.agent || '—'}</td>
                            {showClient ? <td>{doc.clientName || '—'}</td> : null}
                            <td className="cm delivery-col-lines">{doc.lines.length}</td>
                            <td className="cm">{fmt(doc.qty)}</td>
                            <td>{fmt(doc.cash)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={showClient ? 4 : 3}>
                            <b>{t('oversite.total')}</b>
                          </td>
                          <td className="cm delivery-col-lines">
                            <b>{docs.reduce((n, d) => n + d.lines.length, 0)}</b>
                          </td>
                          <td className="cm">
                            <b>{fmt(metrics.qty)}</b>
                          </td>
                          <td>
                            <b>{fmt(metrics.cash)}</b>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function DeliveryDocDetail({ doc, onBack }: { doc: OrderTodayGroup; onBack: () => void }) {
  const { t } = useLocale()
  return (
    <>
      <button type="button" className="ov-toggle-btn delivery-doc-back" onClick={onBack}>
        {t('oversite.deliveryDocBack')}
      </button>
      <OversiteKpiRow
        kpis={[
          { label: t('oversite.deliveryDocNumber'), value: doc.docNum },
          { label: t('oversite.orderDate'), value: formatOrderDateDisp(doc.orderDate) },
          { label: t('oversite.debtAgent'), value: doc.agent || '—' },
          ...(doc.clientName ? [{ label: t('oversite.orderClientName'), value: doc.clientName }] : []),
        ]}
      />
      <div className="tw delivery-doc-lines">
        <table className="ov-orders-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>{t('oversite.orderItem')}</th>
              <th>{t('oversite.qty')}</th>
              <th>{t('oversite.cash')}</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((line, i) => (
              <tr key={`${line.itemSKU}-${i}`}>
                <td className="cm">{line.itemSKU || '—'}</td>
                <td>{line.itemName || '—'}</td>
                <td className="cm">{fmt(Number(line.qty) || 0)}</td>
                <td>{fmt(Number(line.cash) || 0)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>
                <b>{t('oversite.total')}</b>
              </td>
              <td className="cm">
                <b>{fmt(doc.qty)}</b>
              </td>
              <td>
                <b>{fmt(doc.cash)}</b>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  )
}
