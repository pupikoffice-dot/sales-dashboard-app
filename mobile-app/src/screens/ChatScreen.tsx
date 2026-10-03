import { useState, useRef, useCallback, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Voice, { SpeechResultsEvent } from '@react-native-voice/voice'
import * as Speech from 'expo-speech'
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase'
import { stripMarkdownForSpeech } from '../lib/stripMarkdownForSpeech'
import { ChatAssistantMarkdown } from '../components/ChatAssistantMarkdown'
import { useAuth } from '../context/AuthContext'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  clientId?: string
  clientName?: string
  /** pupik | mt | grow — must match sales_lines.company when set */
  clientCompany?: string
  onOpenClientList?: () => void
}

export function ChatScreen({ clientId, clientName, clientCompany, onOpenClientList }: Props) {
  const { profile, session, signOut } = useAuth()
  const [messages, setMessages]     = useState<Message[]>([])
  const [input, setInput]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [syncing, setSyncing]       = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [autoPlay, setAutoPlay]     = useState(false)
  const listRef                     = useRef<FlatList>(null)

  // ── Voice setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      const recognized = e.value?.[0] ?? ''
      if (recognized) sendMessageWithText(recognized)
      setIsListening(false)
    }
    Voice.onSpeechError = () => setIsListening(false)
    Voice.onSpeechEnd   = () => setIsListening(false)

    return () => {
      Voice.destroy().then(Voice.removeAllListeners).catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleListening() {
    if (isListening) {
      await Voice.stop()
      setIsListening(false)
    } else {
      try {
        await Voice.start('iw-IL')
        setIsListening(true)
      } catch {
        Alert.alert('שגיאה', 'לא ניתן להפעיל זיהוי קולי. בדוק הרשאות מיקרופון.')
      }
    }
  }

  function speakText(text: string) {
    Speech.stop()
    Speech.speak(stripMarkdownForSpeech(text), { language: 'he-IL', rate: 1.0 })
  }

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessageWithText = useCallback(async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text.trim() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const { data: { session: freshSession } } = await supabase.auth.getSession()
      const token = freshSession?.access_token
      if (!token) throw new Error('Not authenticated')

      const history = messages.map(m => ({ role: m.role, content: m.content }))
      const res = await fetch(`${supabaseUrl}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text.trim(),
          history,
          client_id: clientId,
          client_company: clientCompany,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        const errMsg = data.error ?? `HTTP ${res.status}`
        if (errMsg.includes('Device revoked')) {
          Alert.alert('מכשיר חסום', 'מכשיר זה נחסם. פנה למנהל שלך.', [
            { text: 'התנתקות', onPress: signOut },
          ])
          return
        }
        if (errMsg.includes('query limit')) {
          setMessages(prev => [...prev, { id: Date.now().toString() + 'e', role: 'assistant', content: '⚠️ הגעת למגבלת השאילתות החודשית. פנה למנהל שלך.' }])
          return
        }
        throw new Error(errMsg)
      }

      const reply = data.reply as string
      const assistantMsg: Message = { id: Date.now().toString() + 'a', role: 'assistant', content: reply }
      setMessages(prev => [...prev, assistantMsg])
      if (autoPlay) speakText(reply)
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now().toString() + 'err',
        role: 'assistant',
        content: `שגיאה: ${(err as Error).message}`,
      }])
    } finally {
      setLoading(false)
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }, [loading, messages, session, clientId, clientCompany, signOut, autoPlay])

  const sendMessage = useCallback(() => {
    const text = input.trim()
    if (!text) return
    setInput('')
    sendMessageWithText(text)
  }, [input, sendMessageWithText])

  // ── Sync ──────────────────────────────────────────────────────────────────
  async function triggerSync() {
    setSyncing(true)
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/trigger-sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          apikey: supabaseAnonKey,
          'Content-Type': 'application/json',
        },
      })
      const data = await res.json()
      Alert.alert('סנכרון', data.message ?? (data.success ? 'הסנכרון הופעל' : 'הסנכרון נכשל'))
    } catch (err) {
      Alert.alert('שגיאת סנכרון', (err as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  // ── Render message ────────────────────────────────────────────────────────
  function renderMessage({ item }: { item: Message }) {
    const isUser = item.role === 'user'
    return (
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
        {isUser ? (
          <Text style={[styles.bubbleText, styles.userText]}>{item.content}</Text>
        ) : (
          <ChatAssistantMarkdown content={item.content} />
        )}
        {!isUser && (
          <TouchableOpacity onPress={() => speakText(item.content)} style={styles.speakBtn}>
            <Text style={styles.speakIcon}>🔊</Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{clientName ?? 'צ\'אט'}</Text>
          <Text style={styles.headerSub}>{profile?.name ?? ''}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setAutoPlay(v => !v)} style={[styles.headerBtn, autoPlay && styles.headerBtnActive]}>
            <Text style={styles.headerBtnText}>{autoPlay ? '🔊' : '🔇'}</Text>
          </TouchableOpacity>
          {onOpenClientList && (
            <TouchableOpacity onPress={onOpenClientList} style={styles.headerBtn}>
              <Text style={styles.headerBtnText}>לקוחות</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={triggerSync} disabled={syncing} style={styles.headerBtn}>
            {syncing
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.headerBtnText}>סנכרון</Text>
            }
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {clientName
                ? `שאל כל שאלה על ${clientName} — הזמנות, מוצרים, היסטוריה.`
                : 'שאל אותי על הלקוחות או נתוני המכירות שלך.'}
            </Text>
          </View>
        }
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.inputRow}>
          <TouchableOpacity
            style={[styles.micBtn, isListening && styles.micBtnActive]}
            onPress={toggleListening}
            activeOpacity={0.8}
          >
            <Text style={styles.micIcon}>{isListening ? '⏹' : '🎤'}</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={isListening ? 'מאזין...' : 'שאל על לקוח...'}
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={1000}
            onSubmitEditing={sendMessage}
            textAlign="right"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.sendText}>שלח</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f8fafc' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#001a4d' },
  headerTitle:  { color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'right' },
  headerSub:    { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 1, textAlign: 'right' },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn:    { borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  headerBtnActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  headerBtnText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  messageList:  { padding: 16, paddingBottom: 8, flexGrow: 1 },
  bubble:       { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10 },
  userBubble:   { backgroundColor: '#1d4ed8', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  aiBubble:     { backgroundColor: '#fff', alignSelf: 'flex-end', borderBottomRightRadius: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  bubbleText:   { fontSize: 15, lineHeight: 22 },
  userText:     { color: '#fff' },
  speakBtn:     { alignSelf: 'flex-end', marginTop: 4 },
  speakIcon:    { fontSize: 14 },
  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyText:    { color: '#9ca3af', fontSize: 14, textAlign: 'center', lineHeight: 22, maxWidth: 260 },
  inputRow:     { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  micBtn:       { backgroundColor: '#f3f4f6', borderRadius: 12, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  micBtnActive: { backgroundColor: '#fee2e2' },
  micIcon:      { fontSize: 20 },
  input:        { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#111827', maxHeight: 100, backgroundColor: '#fff' },
  sendBtn:      { backgroundColor: '#1d4ed8', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12, justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  sendText:     { color: '#fff', fontWeight: '600', fontSize: 15 },
})
