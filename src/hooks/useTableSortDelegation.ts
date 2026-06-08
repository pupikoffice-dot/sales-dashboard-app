import { useEffect } from 'react'
import { sortTableDom } from '../lib/sortTableDom'

export function useTableSortDelegation(rootId = 'sales-report') {
  useEffect(() => {
    const root = document.getElementById(rootId)
    if (!root) return

    function onClick(e: MouseEvent) {
      const th = (e.target as Element).closest('th.sortable')
      if (!th || !root!.contains(th)) return
      sortTableDom(th as HTMLTableCellElement)
    }

    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
  }, [rootId])
}
