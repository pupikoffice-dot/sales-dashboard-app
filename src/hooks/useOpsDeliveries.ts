import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { OpsDeliveryMonthRow } from '../lib/opsDeliveries'

async function fetchOpsDeliveriesMonthly(months: number): Promise<OpsDeliveryMonthRow[]> {
  const { data, error } = await supabase.rpc('get_ops_deliveries_monthly', { p_months: months })
  if (error) throw error
  return ((data ?? []) as OpsDeliveryMonthRow[]).map(r => ({
    company: String(r.company ?? ''),
    ym: String(r.ym ?? ''),
    cartons: Number(r.cartons) || 0,
    pallets: Number(r.pallets) || 0,
  }))
}

export function useOpsDeliveries(months = 12) {
  return useQuery({
    queryKey: ['ops-deliveries-monthly', months],
    queryFn: () => fetchOpsDeliveriesMonthly(months),
    staleTime: 5 * 60_000,
  })
}
