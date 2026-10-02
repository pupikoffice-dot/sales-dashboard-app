import { useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useChatSession, type ChatMessage } from '../context/ChatSessionContext'
import { Send, Bot, User, ChevronDown } from 'lucide-react'
import { ChatAssistantMarkdown } from '../components/ChatAssistantMarkdown'

const supabaseUrl     = (import.meta.env.VITE_SUPABASE_URL     as string) ?? ''
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? ''

/** Value encodes erp_client_id + company so sales_lines can filter by company (pupik/mt/grow). */
function encodeClientValue(erp: string, company: string) {
  return `${erp}::${company}`
}

function parseClientValue(raw: string): { erp: string; company?: string } {
  if (!raw) return { erp: '' }
  const i = raw.indexOf('::')
  if (i === -1) return { erp: raw }
  return { erp: raw.slice(0, i), company: raw.slice(i + 2) }
}

export function ChatPage() {
  const { session } = useAuth()
  const {
    messages,
    setMessages,
    input,
    setInput,
    loading,
    setLoading,
    clientId,
    setClientId,
  } = useChatSession()
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Client list for selector
  const { data: clients = [] } = useQuery({
    queryKey: ['chat-client-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('erp_client_id, name, company')
        .eq('active', true)
        .order('name')
        .limit(500)
      return data ?? []
    },
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [input])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    const userMsg: ChatMessage = { role: 'user', content: text.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const token = session?.access_token
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
          ...(() => {
            const { erp, company } = parseClientValue(clientId)
            return {
              client_id: erp || undefined,
              client_company: company,
            }
          })(),
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMessages([...newMessages, { role: 'assistant', content: data.reply }])
    } catch (err: any) {
      setMessages([...newMessages, { role: 'assistant', content: `Error: ${err.message}` }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const selectedClient = clients.find(c => encodeClientValue(c.erp_client_id, c.company) === clientId)

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chat</h1>
          <p className="text-sm text-gray-500 mt-0.5">Test and tune the AI assistant</p>
        </div>

        {/* Client selector */}
        <div className="relative">
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white shadow-sm min-w-64 cursor-pointer">
            <ChevronDown size={14} className="text-gray-400 shrink-0" />
            <select
              value={clientId}
              onChange={e => { setClientId(e.target.value); setMessages([]) }}
              className="flex-1 text-sm bg-transparent outline-none cursor-pointer text-gray-700"
            >
              <option value="">General chat (no client)</option>
              {clients.map(c => (
                <option key={`${c.erp_client_id}-${c.company}`} value={encodeClientValue(c.erp_client_id, c.company)}>
                  {c.name} — {c.company}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Context badge */}
      {clientId && selectedClient && (
        <div className="mb-3 flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          <Bot size={13} />
          <span>Client context active: <strong>{selectedClient.name}</strong> ({selectedClient.erp_client_id}) — {selectedClient.company}</span>
          <button onClick={() => { setClientId(''); setMessages([]) }} className="ml-auto text-blue-400 hover:text-blue-600">✕</button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-white border border-gray-100 rounded-xl shadow-ambient p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
            <Bot size={40} strokeWidth={1.5} />
            <p className="text-sm">Ask about clients, sales, inventory, or pricing.</p>
            {!clientId && <p className="text-xs">Select a client above for client-specific context.</p>}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="shrink-0 w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
                <Bot size={14} className="text-blue-600" />
              </div>
            )}
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-[#001a4d] text-white rounded-br-sm whitespace-pre-wrap'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}
            >
              {m.role === 'assistant' ? (
                <ChatAssistantMarkdown content={m.content} />
              ) : (
                m.content
              )}
            </div>
            {m.role === 'user' && (
              <div className="shrink-0 w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center mt-0.5">
                <User size={14} className="text-gray-600" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="shrink-0 w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
              <Bot size={14} className="text-blue-600" />
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-2 items-end bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
          rows={1}
          className="flex-1 resize-none outline-none text-sm text-gray-800 placeholder-gray-400 bg-transparent"
          style={{ minHeight: '24px', maxHeight: '160px' }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || loading}
          className="shrink-0 w-8 h-8 rounded-lg bg-[#001a4d] hover:bg-[#003080] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
        >
          <Send size={14} className="text-white" />
        </button>
      </div>
      <p className="text-center text-xs text-gray-400 mt-1.5">Enter to send · Shift+Enter for new line · Switch client to reset context</p>
    </div>
  )
}
