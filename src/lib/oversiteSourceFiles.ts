import type { LogicalCompany } from '../types/dashboard'

/**
 * Maps each Oversight section to the raw ERP file(s) its data originates
 * from, per company — shown as a hover tooltip, super-admin only, so admins
 * can trace a figure back to its source export without digging through the
 * ETL. Mirrors the file map in Mobile App for salesteam/sync/excel_parser.py
 * (detect_file_type) and sync_to_supabase.py (_sync_receipts /
 * _sync_debt_file_dates).
 */
export type OversiteSegment =
  | 'ordersToday'
  | 'ordersMtd'
  | 'openOrders'
  | 'salesMtd'
  | 'deliveryNotes'
  | 'topItems'
  | 'suppliers'
  | 'returns'
  | 'debt'
  | 'receipts'

const FILES: Record<OversiteSegment, Partial<Record<LogicalCompany, string>>> = {
  ordersToday: { pupik: '722pupik.xls', mt: '722mt.xls', grow: '722grow.xls', gold: '722gold.xls' },
  ordersMtd: { pupik: '722pupik.xls', mt: '722mt.xls', grow: '722grow.xls', gold: '722gold.xls' },
  openOrders: { pupik: '721pupik.xls', mt: '721mt.xls', grow: '721grow.xls', gold: '721gold.xls' },
  salesMtd: { pupik: 'rep891pupik.xls', mt: 'rep891mt.xls', grow: 'rep891grow.xls', gold: 'rep891gold.xls' },
  deliveryNotes: { pupik: '720pupik.xls', mt: '720mt.xls', grow: '720grow.xls', gold: '720gold.xls' },
  topItems: { pupik: 'rep891pupik.xls', mt: 'rep891mt.xls', grow: 'rep891grow.xls', gold: 'rep891gold.xls' },
  suppliers: { pupik: 'rep891pupik.xls', mt: 'rep891mt.xls', grow: 'rep891grow.xls', gold: 'rep891gold.xls' },
  returns: { pupik: '855PUP.xls', mt: '855MT.xls' },
  debt: { pupik: 'Debt clients.xlsm (pupik)', mt: 'Debt clients.xlsm (monkey)', grow: 'Debt clients.xlsm (grow)' },
  receipts: { pupik: 'collectyear008pupik.xls', mt: 'collectyear008mt.xls' },
}

/** Source-file label for a section+company, or undefined if none is mapped. */
export function getOversiteSourceFile(
  segment: OversiteSegment,
  company: LogicalCompany,
): string | undefined {
  return FILES[segment]?.[company]
}
