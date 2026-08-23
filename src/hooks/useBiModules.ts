import { useQuery } from '@tanstack/react-query'
import { fetchBiConfig, fetchBiModules } from '../lib/biModulesApi'

export function useBiModulesCatalog() {
  return useQuery({
    queryKey: ['bi-modules'],
    queryFn: fetchBiModules,
    staleTime: 5 * 60_000,
  })
}

export function useBiConfig() {
  return useQuery({
    queryKey: ['bi-config'],
    queryFn: fetchBiConfig,
    staleTime: 60_000,
  })
}
