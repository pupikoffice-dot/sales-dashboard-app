import { useLayoutEffect } from 'react'
import { attachAllTableColumnFilters } from '../lib/tableColumnFilters'

export function useTableColumnFilters(rootId = 'sales-report') {
  useLayoutEffect(() => {
    const root = document.getElementById(rootId)
    if (!root) return

    let pending = 0

    const mount = () => {
      attachAllTableColumnFilters(root)
    }

    const scheduleMount = () => {
      if (pending) cancelAnimationFrame(pending)
      pending = requestAnimationFrame(() => {
        pending = requestAnimationFrame(mount)
      })
    }

    scheduleMount()
    const lateMount = window.setTimeout(scheduleMount, 300)

    const mo = new MutationObserver(scheduleMount)
    mo.observe(root, { childList: true, subtree: true })

    return () => {
      window.clearTimeout(lateMount)
      mo.disconnect()
      if (pending) cancelAnimationFrame(pending)
    }
  }, [rootId])
}
