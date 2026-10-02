import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const STORAGE_PREFIX = 'sales-admin-chat:'

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`
}

function readStored(userId: string | undefined): {
  messages: ChatMessage[]
  clientId: string
  input: string
} {
  if (!userId || typeof sessionStorage === 'undefined') {
    return { messages: [], clientId: '', input: '' }
  }
  try {
    const raw = sessionStorage.getItem(storageKey(userId))
    if (!raw) return { messages: [], clientId: '', input: '' }
    const p = JSON.parse(raw) as Record<string, unknown>
    return {
      messages: Array.isArray(p.messages) ? (p.messages as ChatMessage[]) : [],
      clientId: typeof p.clientId === 'string' ? p.clientId : '',
      input: typeof p.input === 'string' ? p.input : '',
    }
  } catch {
    return { messages: [], clientId: '', input: '' }
  }
}

function writeStored(userId: string, data: { messages: ChatMessage[]; clientId: string; input: string }) {
  try {
    sessionStorage.setItem(storageKey(userId), JSON.stringify(data))
  } catch {
    // quota / private mode
  }
}

function clearStored(userId: string) {
  try {
    sessionStorage.removeItem(storageKey(userId))
  } catch {
    /* ignore */
  }
}

interface ChatSessionValue {
  messages: ChatMessage[]
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  clientId: string
  setClientId: (v: string) => void
  input: string
  setInput: (v: string) => void
  loading: boolean
  setLoading: (v: boolean) => void
}

const ChatSessionContext = createContext<ChatSessionValue | null>(null)

/**
 * Persists admin Chat across /admin/* tab switches (sessionStorage + context).
 * Cleared when the browser tab closes or on logout.
 */
export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user?.id ?? null

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [clientId, setClientId] = useState('')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  /** False until storage has been read (or re-read) for this user — prevents persist effect from wiping sessionStorage with initial empty state. */
  const [storageReady, setStorageReady] = useState(false)

  /** Only hydrate from sessionStorage once per logged-in user id (avoids wiping state on re-renders). */
  const hydratedForUserId = useRef<string | null>(null)

  useLayoutEffect(() => {
    if (!userId) {
      hydratedForUserId.current = null
      setMessages([])
      setClientId('')
      setInput('')
      setLoading(false)
      setStorageReady(false)
      return
    }

    if (hydratedForUserId.current === userId) {
      setStorageReady(true)
      return
    }

    hydratedForUserId.current = userId
    const s = readStored(userId)
    setMessages(s.messages)
    setClientId(s.clientId)
    setInput(s.input)
    setStorageReady(true)
  }, [userId])

  useEffect(() => {
    if (!userId || !storageReady) return
    writeStored(userId, { messages, clientId, input })
  }, [userId, storageReady, messages, clientId, input])

  useEffect(() => {
    if (!session) {
      // Logout: clear any leftover key for the last user we had in memory
      const uid = hydratedForUserId.current
      if (uid) clearStored(uid)
      hydratedForUserId.current = null
    }
  }, [session])

  return (
    <ChatSessionContext.Provider
      value={{
        messages,
        setMessages,
        clientId,
        setClientId,
        input,
        setInput,
        loading,
        setLoading,
      }}
    >
      {children}
    </ChatSessionContext.Provider>
  )
}

export function useChatSession() {
  const ctx = useContext(ChatSessionContext)
  if (!ctx) {
    throw new Error('useChatSession must be used within ChatSessionProvider')
  }
  return ctx
}
