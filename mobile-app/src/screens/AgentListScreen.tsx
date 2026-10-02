import { useState } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

interface Agent {
  id: string
  name: string
  email: string
  active: boolean
}

interface Props {
  onSelectAgent: (agentId: string, agentName: string) => void
  onBack: () => void
}

export function AgentListScreen({ onSelectAgent, onBack }: Props) {
  const [search, setSearch] = useState('')

  const { data: agents = [], isLoading } = useQuery<Agent[]>({
    queryKey: ['my-agents'],
    queryFn: async () => {
      const { data: subtree, error: rpcErr } = await supabase.rpc('get_subtree_ids', {
        p_user_id: (await supabase.auth.getUser()).data.user?.id,
      })
      if (rpcErr) throw rpcErr
      if (!subtree || subtree.length === 0) return []

      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, name, email, active')
        .in('id', subtree)
        .eq('role', 'agent')
        .order('name')
      if (error) throw error
      return data
    },
  })

  const filtered = agents.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.email.toLowerCase().includes(search.toLowerCase())
  )

  function renderItem({ item }: { item: Agent }) {
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => onSelectAgent(item.id, item.name)}
        activeOpacity={0.7}
      >
        <Text style={styles.arrow}>‹</Text>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.rowInfo}>
          <Text style={styles.agentName}>{item.name}</Text>
          <Text style={styles.agentEmail}>{item.email}</Text>
        </View>
        <View style={[styles.badge, item.active ? styles.badgeActive : styles.badgeInactive]}>
          <Text style={[styles.badgeText, item.active ? styles.badgeTextActive : styles.badgeTextInactive]}>
            {item.active ? 'פעיל' : 'לא פעיל'}
          </Text>
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
        <Text style={styles.title}>הצוות שלי</Text>
        <Text style={styles.count}>{agents.length}</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="חפש נציגים..."
          placeholderTextColor="rgba(255,255,255,0.5)"
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
          keyExtractor={a => a.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>לא נמצאו נציגים</Text>
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
  row:             { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, gap: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  arrow:           { fontSize: 22, color: '#9ca3af' },
  avatar:          { width: 38, height: 38, borderRadius: 19, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' },
  avatarText:      { fontSize: 16, fontWeight: '700', color: '#1d4ed8' },
  rowInfo:         { flex: 1 },
  agentName:       { fontSize: 15, fontWeight: '600', color: '#111827' },
  agentEmail:      { fontSize: 12, color: '#6b7280', marginTop: 1 },
  badge:           { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  badgeActive:     { backgroundColor: '#d1fae5' },
  badgeInactive:   { backgroundColor: '#fee2e2' },
  badgeText:       { fontSize: 11, fontWeight: '600' },
  badgeTextActive: { color: '#065f46' },
  badgeTextInactive: { color: '#991b1b' },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText:       { color: '#9ca3af', fontSize: 14 },
})
