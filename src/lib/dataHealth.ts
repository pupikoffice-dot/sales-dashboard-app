import type { SalesRow } from '../types/dashboard'

export interface DataHealthResult {
  ok: boolean
  message: string | null
}

export function checkOrdersDataHealth(rows: SalesRow[]): DataHealthResult {
  let ordersPupik = 0
  let ordersMt = 0
  let openPupik = 0
  let openMt = 0

  for (const r of rows) {
    switch (r.company) {
      case 'orders-pupik':
        ordersPupik++
        break
      case 'orders-mt':
        ordersMt++
        break
      case 'openorders':
        openPupik++
        break
      case 'openorders-mt':
        openMt++
        break
      default:
        break
    }
  }

  if (ordersPupik < 1000 && openPupik > 2000) {
    return {
      ok: false,
      message:
        'Orders data looks wrong: 722 rows are tagged as openorders instead of orders-pupik. Re-run run_export.ps1 on the office PC (not VBA-only export), then push_to_github.ps1.',
    }
  }

  if (ordersMt < 1000 && openMt > 500) {
    return {
      ok: false,
      message:
        'Orders data looks wrong: 722 MT rows are tagged as openorders-mt instead of orders-mt. Re-run run_export.ps1 on the office PC.',
    }
  }

  if (openPupik === 0 && openMt === 0 && ordersPupik > 0) {
    return {
      ok: false,
      message:
        'Open Orders (721) data is missing from the export. Re-run the Excel export (721pupik / 721mt sheets), then push_to_github.ps1.',
    }
  }

  if (ordersMt > 1000 && openMt === 0) {
    return {
      ok: false,
      message:
        'Monkeytime open orders (721mt) are missing from the export — only Pupik 721 may be present. Check 721mt sheet in the workbook export, then push_to_github.ps1.',
    }
  }

  return { ok: true, message: null }
}
