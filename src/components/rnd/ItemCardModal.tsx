import { useEffect } from 'react'
import { ItemCardPage } from '../../pages/rnd/ItemCardPage'
import type { LogicalCompany } from '../../types/dashboard'

/** The Item card in a popup, over the page the user came from. Closing it (button, Esc, click outside) returns to that page as it was. */
export function ItemCardModal({ company, sku, closeLabel, onClose }: { company: LogicalCompany; sku: string; closeLabel: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="debt-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="debt-modal" style={{ maxWidth: 1300 }} role="dialog" aria-modal="true" aria-label={sku}>
        <div className="debt-modal-hdr">
          <span>{sku}</span>
          <div className="debt-modal-hdr-actions">
            <button type="button" className="debt-modal-close" onClick={onClose}>
              {closeLabel} ✕
            </button>
          </div>
        </div>
        <div className="debt-modal-body">
          <ItemCardPage embedded={{ co: company, sku }} />
        </div>
      </div>
    </div>
  )
}

/** A SKU that opens the item card popup when clicked. */
export function ItemLink({ sku, onOpen }: { sku: string; onOpen: (sku: string) => void }) {
  return (
    <button type="button" className="pt-link" onClick={() => onOpen(sku)}>
      {sku}
    </button>
  )
}
