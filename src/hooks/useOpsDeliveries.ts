import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type {
  DeliveryBox,
  DeliveryEntity,
  DeliveryEntityKind,
  OpsDeliveryMonthRow,
} from '../lib/opsDeliveries'
import type { LogicalCompany } from '../types/dashboard'

export interface OpsDeliveryFilter {
  company: LogicalCompany
  kind: DeliveryEntityKind
  entityId: string
}

async function fetchOpsDeliveriesMonthly(
  months: number,
  filter: OpsDeliveryFilter | null,
): Promise<OpsDeliveryMonthRow[]> {
  const { data, error } = await supabase.rpc('get_ops_deliveries_monthly', {
    p_months: months,
    p_company: filter?.company ?? null,
    p_agent: filter?.kind === 'agent' ? filter.entityId : null,
    p_client: filter?.kind === 'client' ? filter.entityId : null,
  })
  if (error) throw error
  return ((data ?? []) as OpsDeliveryMonthRow[]).map(r => ({
    company: String(r.company ?? ''),
    ym: String(r.ym ?? ''),
    cartons: Number(r.cartons) || 0,
    pallets: Number(r.pallets) || 0,
  }))
}

export function useOpsDeliveries(months = 12, filter: OpsDeliveryFilter | null = null) {
  return useQuery({
    queryKey: ['ops-deliveries-monthly', months, filter?.company, filter?.kind, filter?.entityId],
    queryFn: () => fetchOpsDeliveriesMonthly(months, filter),
    staleTime: 5 * 60_000,
  })
}

async function fetchOpsDeliveryEntities(): Promise<DeliveryEntity[]> {
  const { data, error } = await supabase.rpc('get_ops_delivery_entities')
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map(r => ({
    company: String(r.company ?? ''),
    kind: r.kind === 'agent' ? 'agent' : 'client',
    entityId: String(r.entity_id ?? ''),
    name: String(r.name ?? r.entity_id ?? ''),
    cartons: Number(r.cartons) || 0,
    pallets: Number(r.pallets) || 0,
  }))
}

export function useOpsDeliveryEntities(enabled: boolean) {
  return useQuery({
    queryKey: ['ops-delivery-entities'],
    queryFn: fetchOpsDeliveryEntities,
    staleTime: 10 * 60_000,
    enabled,
  })
}

const BOXES_KEY = ['ops-delivery-boxes']

async function fetchOpsDeliveryBoxes(): Promise<DeliveryBox[]> {
  const { data, error } = await supabase
    .from('ops_delivery_boxes')
    .select('id, company, kind, entity_id, label')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(r => ({
    id: String(r.id),
    company: r.company as LogicalCompany,
    kind: r.kind === 'agent' ? 'agent' : 'client',
    entityId: String(r.entity_id),
    label: String(r.label ?? ''),
  }))
}

export function useOpsDeliveryBoxes() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: BOXES_KEY, queryFn: fetchOpsDeliveryBoxes, staleTime: 5 * 60_000 })

  const add = useMutation({
    mutationFn: async (box: Omit<DeliveryBox, 'id'>) => {
      const { error } = await supabase.from('ops_delivery_boxes').insert({
        company: box.company,
        kind: box.kind,
        entity_id: box.entityId,
        label: box.label,
      })
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: BOXES_KEY }),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ops_delivery_boxes').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: BOXES_KEY }),
  })

  return { ...query, add, remove }
}
