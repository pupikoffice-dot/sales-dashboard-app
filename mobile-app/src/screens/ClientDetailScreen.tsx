import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

interface Props {
  clientId: string
  clientName: string
  /** Pass company so chat edge function can filter sales_lines.company */
  onChat: (clientCompany?: string) => void
  onBack: () => void
}

interface SalesLine {
  id: number
  line_date: string
  item_name: string
  qty: number
  cash: number
  brand: string
  doc_type: string
}

interface ClientInfo {
  name: string
  company: string
  phone: string | null
  email: string | null
  region: string | null
}

export function ClientDetailScreen({ clientId, clientName, onChat, onBack }: Props) {
  const { data: client } = useQuery<ClientInfo | null>({
    queryKey: ['client-info', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('name, company, phone, email, region')
        .eq('erp_client_id', clientId)
        .single()
      if (error) return null
      return data
    },
  })

  const { data: sales = [], isLoading } = useQuery<SalesLine[]>({
    queryKey: ['client-sales', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_lines')
        .select('id, line_date, item_name, qty, cash, brand, doc_type')
        .eq('client_id', clientId)
        .order('line_date', { ascending: false })
        .limit(30)
      if (error) throw error
      return data
    },
  })

  const totalCash = sales.reduce((sum, s) => sum + (s.cash ?? 0), 0)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onChat(client?.company)} style={styles.chatBtn}>
          <Text style={styles.chatBtnText}>צ'אט</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{clientName}</Text>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>חזרה ›</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {client && (
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>פרטי קשר</Text>
            <InfoRow label="חברה"   value={client.company} />
            <InfoRow label="טלפון"  value={client.phone} />
            <InfoRow label="אימייל" value={client.email} />
            <InfoRow label="אזור"   value={client.region} />
          </View>
        )}

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{sales.length}</Text>
            <Text style={styles.summaryLabel}>שורות (30 אחרונות)</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>₪{totalCash.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</Text>
            <Text style={styles.summaryLabel}>סה"כ</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>מכירות אחרונות</Text>
          {isLoading ? (
            <ActivityIndicator color="#1d4ed8" style={{ marginTop: 16 }} />
          ) : sales.length === 0 ? (
            <Text style={styles.emptyText}>אין נתוני מכירות</Text>
          ) : (
            sales.map(s => (
              <View key={s.id} style={styles.saleRow}>
                <View style={styles.saleRight}>
                  <Text style={styles.saleQty}>×{s.qty}</Text>
                  <Text style={styles.saleCash}>₪{(s.cash ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}</Text>
                </View>
                <View style={styles.saleLeft}>
                  <Text style={styles.saleItem}>{s.item_name ?? '—'}</Text>
                  <Text style={styles.saleMeta}>{s.line_date} · {s.brand ?? '—'} · {s.doc_type ?? '—'}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoValue}>{value ?? '—'}</Text>
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f8fafc' },
  header:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#001a4d', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:      { paddingLeft: 4 },
  backText:     { color: '#fff', fontSize: 15, fontWeight: '500' },
  headerTitle:  { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  chatBtn:      { paddingRight: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  chatBtnText:  { color: '#fff', fontSize: 13, fontWeight: '500' },
  content:      { padding: 16, gap: 16 },
  infoCard:     { backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, textAlign: 'right' },
  infoRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  infoLabel:    { fontSize: 13, color: '#6b7280' },
  infoValue:    { fontSize: 13, color: '#111827', fontWeight: '500' },
  summaryRow:   { flexDirection: 'row', gap: 12 },
  summaryCard:  { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  summaryValue: { fontSize: 24, fontWeight: '700', color: '#1d4ed8' },
  summaryLabel: { fontSize: 12, color: '#6b7280', marginTop: 2, textAlign: 'center' },
  section:      { backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  saleRow:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  saleLeft:     { flex: 1, paddingRight: 12 },
  saleItem:     { fontSize: 14, fontWeight: '500', color: '#111827', textAlign: 'right' },
  saleMeta:     { fontSize: 12, color: '#9ca3af', marginTop: 2, textAlign: 'right' },
  saleRight:    { alignItems: 'flex-start' },
  saleQty:      { fontSize: 13, color: '#6b7280' },
  saleCash:     { fontSize: 14, fontWeight: '600', color: '#059669', marginTop: 2 },
  emptyText:    { color: '#9ca3af', fontSize: 14, textAlign: 'center', paddingVertical: 20 },
})
