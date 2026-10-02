import { useState } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

interface Client {
  id: string
  erp_client_id: string
  name: string
  company: string
  phone: string | null
}

interface Props {
  onSelectClient: (clientId: string, clientName: string) => void
  onBack: () => void
  agentId?: string
}

export function ClientListScreen({ onSelectClient, onBack, agentId }: Props) {
  const [search, setSearch] = useState('')

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ['clients', agentId],
    queryFn: async () => {
      let q = supabase
        .from('clients')
        .select('id, erp_client_id, name, company, phone')
        .eq('active', true)
        .order('name')

      if (agentId) q = q.eq('assigned_agent_id', agentId)

      const { data, error } = await q
      if (error) throw error
      return data
    },
  })

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.erp_client_id.toLowerCase().includes(search.toLowerCase())
  )

  const companyColors: Record<string, string> = {
    pupik: '#3b82f6',
    mt:    '#10b981',
    grow:  '#f59e0b',
    gold:  '#d97706',
  }

  function renderItem({ item }: { item: Client }) {
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => onSelectClient(item.erp_client_id, item.name)}
        activeOpacity={0.7}
      >
        <Text style={styles.arrow}>‹</Text>
        <View style={styles.rowLeft}>
          <View style={[styles.dot, { backgroundColor: companyColors[item.company] ?? '#9ca3af' }]} />
          <View>
            <Text style={styles.clientName}>{item.name}</Text>
            <Text style={styles.clientSub}>{item.erp_client_id} · {item.company}</Text>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>› חזרה</Text>
        </TouchableOpacity>
        <Text style={styles.title}>לקוחות</Text>
        <Text style={styles.count}>{filtered.length}</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="חפש לפי שם או מזהה..."
          placeholderTextColor="rgba(255,255,255,0.5)"
          clearButtonMode="while-editing"
          textAlign="right"
        />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#1d4ed8" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={c => c.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>לא נמצאו לקוחות</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#f8fafc' },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: '#001a4d' },
  backBtn:         { paddingLeft: 4 },
  backText:        { color: '#fff', fontSize: 15, fontWeight: '500' },
  title:           { color: '#fff', fontSize: 20, fontWeight: '700', flex: 1, textAlign: 'center' },
  count:           { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '500', minWidth: 30, textAlign: 'left' },
  searchContainer: { backgroundColor: '#001a4d', paddingHorizontal: 16, paddingBottom: 12 },
  search:          { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, color: '#fff' },
  list:            { padding: 12 },
  row:             { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  rowLeft:         { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  dot:             { width: 10, height: 10, borderRadius: 5 },
  clientName:      { fontSize: 15, fontWeight: '600', color: '#111827' },
  clientSub:       { fontSize: 12, color: '#6b7280', marginTop: 2 },
  arrow:           { fontSize: 22, color: '#9ca3af', marginLeft: 4 },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText:       { color: '#9ca3af', fontSize: 14 },
})
