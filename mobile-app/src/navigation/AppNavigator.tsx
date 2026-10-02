import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Linking, NativeModules, Platform } from 'react-native'
import { AuthProvider, useAuth } from '../context/AuthContext'
import { LoginScreen }        from '../screens/LoginScreen'
import { ChatScreen }         from '../screens/ChatScreen'
import { ClientListScreen }   from '../screens/ClientListScreen'
import { ClientDetailScreen } from '../screens/ClientDetailScreen'
import { AgentListScreen }    from '../screens/AgentListScreen'
import { supabase } from '../lib/supabase'
import * as Application from 'expo-application'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 60_000 } },
})

type Screen =
  | { name: 'chat'; clientId?: string; clientName?: string; clientCompany?: string }
  | { name: 'clients'; agentId?: string; agentName?: string; fromAgents?: boolean }
  | { name: 'client-detail'; clientId: string; clientName: string; fromAgents?: boolean }
  | { name: 'agents' }

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return 1
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return -1
  }
  return 0
}

type ApkUpdateNative = { enqueueApkDownload: (url: string) => Promise<void> }
const apkUpdateNative = NativeModules.ApkUpdateModule as ApkUpdateNative | undefined

function UpdateBanner() {
  const { session } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const currentVersion = Application.nativeApplicationVersion ?? '1.0.0'

  const { data } = useQuery({
    queryKey: ['app-update-check'],
    enabled: !!session,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['app_latest_version', 'app_apk_url'])
      const map = Object.fromEntries((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]))
      return { latestVersion: map['app_latest_version'] ?? '', apkUrl: map['app_apk_url'] ?? '' }
    },
  })

  const updateAvailable =
    data?.latestVersion &&
    data?.apkUrl &&
    compareVersions(data.latestVersion, currentVersion) > 0

  if (!updateAvailable || dismissed) return null

  async function handleUpdate() {
    if (!data?.apkUrl) return
    setDownloading(true)
    try {
      if (Platform.OS === 'android' && typeof apkUpdateNative?.enqueueApkDownload === 'function') {
        // System DownloadManager: no browser tab left open on top of the app
        await apkUpdateNative.enqueueApkDownload(data.apkUrl)
      } else {
        await Linking.openURL(data.apkUrl)
      }
      setDismissed(true)
    } catch {
      try {
        await Linking.openURL(data.apkUrl)
        setDismissed(true)
      } catch {
        // ignore
      }
    } finally {
      setDownloading(false)
    }
  }

  return (
    <View style={bannerStyles.banner}>
      <Text style={bannerStyles.text}>עדכון זמין ({data?.latestVersion})</Text>
      <TouchableOpacity onPress={handleUpdate} disabled={downloading} style={bannerStyles.btn}>
        {downloading
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={bannerStyles.btnText}>עדכן עכשיו</Text>
        }
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setDismissed(true)} style={bannerStyles.dismiss}>
        <Text style={bannerStyles.dismissText}>✕</Text>
      </TouchableOpacity>
    </View>
  )
}

const bannerStyles = StyleSheet.create({
  banner: { backgroundColor: '#065f46', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, gap: 10 },
  text: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
  btn: { backgroundColor: '#059669', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  btnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  dismiss: { padding: 4 },
  dismissText: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
})

function AppContent() {
  const { session, loading, profile } = useAuth()
  const [screen, setScreen] = useState<Screen>({ name: 'chat' })

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#1d4ed8" size="large" />
      </View>
    )
  }

  if (!session) return <LoginScreen />

  const isManagerOrAbove = profile?.role === 'manager' || profile?.role === 'admin' || profile?.role === 'super_admin'

  return (
    <View style={{ flex: 1 }}>
      <UpdateBanner />

      {screen.name === 'agents' && isManagerOrAbove && (
        <AgentListScreen
          onSelectAgent={(agentId, agentName) =>
            setScreen({ name: 'clients', agentId, agentName, fromAgents: true })
          }
          onBack={() => setScreen({ name: 'chat' })}
        />
      )}

      {screen.name === 'clients' && (
        <ClientListScreen
          agentId={'agentId' in screen ? screen.agentId : undefined}
          onSelectClient={(clientId, clientName) =>
            setScreen({ name: 'client-detail', clientId, clientName, fromAgents: (screen as { fromAgents?: boolean }).fromAgents })
          }
          onBack={() => {
            const s = screen as { fromAgents?: boolean }
            setScreen(s.fromAgents ? { name: 'agents' } : { name: 'chat' })
          }}
        />
      )}

      {screen.name === 'client-detail' && (
        <ClientDetailScreen
          clientId={(screen as { clientId: string }).clientId}
          clientName={(screen as { clientName: string }).clientName}
          onChat={(company) =>
            setScreen({
              name: 'chat',
              clientId: (screen as { clientId: string }).clientId,
              clientName: (screen as { clientName: string }).clientName,
              clientCompany: company,
            })
          }
          onBack={() => setScreen({ name: 'clients', fromAgents: (screen as { fromAgents?: boolean }).fromAgents })}
        />
      )}

      {screen.name === 'chat' && (
        <ChatScreen
          clientId={(screen as { clientId?: string }).clientId}
          clientName={(screen as { clientName?: string }).clientName}
          clientCompany={(screen as { clientCompany?: string }).clientCompany}
          onOpenClientList={() =>
            isManagerOrAbove
              ? setScreen({ name: 'agents' })
              : setScreen({ name: 'clients', agentId: profile?.id })
          }
        />
      )}
    </View>
  )
}

export function AppNavigator() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  )
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
})
