import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { useAuth } from '../context/AuthContext'

export function LoginScreen() {
  const { signIn } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSignIn() {
    if (!email || !password) return
    setError('')
    setLoading(true)
    const { error: err } = await signIn(email.trim(), password)
    setLoading(false)
    if (err) setError(err.message)
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>עוזר מכירות</Text>
          <Text style={styles.subtitle}>התחבר לחשבון שלך</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>אימייל</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor="#9ca3af"
            textAlign="right"
          />

          <Text style={[styles.label, { marginTop: 16 }]}>סיסמה</Text>
          <View style={styles.passwordRow}>
            <TouchableOpacity onPress={() => setShowPw(v => !v)} style={styles.eyeBtn}>
              <Text style={styles.eyeText}>{showPw ? 'הסתר' : 'הצג'}</Text>
            </TouchableOpacity>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
              placeholder="••••••••"
              placeholderTextColor="#9ca3af"
              onSubmitEditing={handleSignIn}
              textAlign="right"
            />
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignIn}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>כניסה</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#001a4d' },
  inner:          { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header:         { alignItems: 'center', marginBottom: 32 },
  title:          { fontSize: 28, fontWeight: '700', color: '#fff', letterSpacing: -0.5 },
  subtitle:       { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  card:           { backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 8 },
  label:          { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, textAlign: 'right' },
  input:          { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#111827', marginBottom: 4, backgroundColor: '#fff' },
  passwordRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  eyeBtn:         { paddingHorizontal: 10, paddingVertical: 10 },
  eyeText:        { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  error:          { color: '#dc2626', fontSize: 13, backgroundColor: '#fef2f2', padding: 10, borderRadius: 8, marginTop: 8, marginBottom: 4, textAlign: 'right' },
  button:         { backgroundColor: '#1d4ed8', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  buttonDisabled: { opacity: 0.6 },
  buttonText:     { color: '#fff', fontSize: 16, fontWeight: '600' },
})
