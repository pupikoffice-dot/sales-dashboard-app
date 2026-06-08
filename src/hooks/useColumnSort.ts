import { useCallback, useState } from 'react'
import type { SortDir } from '../lib/tableSort'

interface SortState {
  col: number
  asc: boolean
}

export function useColumnSort() {
  const [sort, setSort] = useState<SortState | null>(null)

  const onSort = useCallback((col: number) => {
    setSort(prev => {
      if (prev?.col === col) return { col, asc: !prev.asc }
      return { col, asc: true }
    })
  }, [])

  const sortIcon = useCallback(
    (col: number): SortDir => {
      if (sort?.col !== col) return null
      return sort.asc ? 'asc' : 'desc'
    },
    [sort],
  )

  return {
    sortCol: sort?.col ?? null,
    sortAsc: sort?.asc ?? true,
    onSort,
    sortIcon,
  }
}
