import type { LogicalCompany } from '../../../types/dashboard'
import { MtdClientLedger } from '../MtdClientLedger'

interface MtdLedgerModalProps {
  title: string
  company: LogicalCompany
  /** The window's agents (null = the whole scope of the signed-in user). Only narrows; the database keeps the caller's scope. */
  agents: string[] | null
  onClose: () => void
}

/** "Full report" of the Sales MTD tile: clients with cash, click a client for invoices, an invoice for its lines. */
export function MtdLedgerModal({ title, company, agents, onClose }: MtdLedgerModalProps) {
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
          <MtdClientLedger company={company} agents={agents ?? undefined} embedded />
        </div>
      </div>
    </div>
  )
}
