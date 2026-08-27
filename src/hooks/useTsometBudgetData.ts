import { useQuery } from '@tanstack/react-query'
import { fetchTsometStoreBudget, fetchTsometStoreSales } from '../lib/tsometBudgetApi'

/** Fetch Tsomet tables only when the cube can render (Monkeytime + granted). */
export function useTsometBudgetData(enabled: boolean) {
  const budgetQ = useQuery({
    queryKey: ['tsomet-store-budget'],
    queryFn: fetchTsometStoreBudget,
    enabled,
    staleTime: 60_000,
  })
  const salesQ = useQuery({
    queryKey: ['tsomet-store-sales'],
    queryFn: fetchTsometStoreSales,
    enabled,
    staleTime: 60_000,
  })
  return {
    budget: budgetQ.data ?? [],
    sales: salesQ.data ?? [],
    isLoading: enabled && (budgetQ.isLoading || salesQ.isLoading),
    error: budgetQ.error ?? salesQ.error,
  }
}
