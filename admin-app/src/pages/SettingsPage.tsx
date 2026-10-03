import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Save } from 'lucide-react'
import type { AppSetting } from '../lib/types'

const PROVIDERS = [
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'claude', label: 'Anthropic Claude' },
  { value: 'openai', label: 'OpenAI' },
]

const MODELS: Record<string, { value: string; label: string }[]> = {
  gemini: [
    { value: 'gemini-2.5-flash',      label: 'Gemini 2.5 Flash (default — fast, best value)' },
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite (cheapest, high volume)' },
    { value: 'gemini-2.5-pro',        label: 'Gemini 2.5 Pro (most capable)' },
  ],
  claude: [
    { value: 'claude-haiku-4-5',   label: 'Claude Haiku 4.5 (fast, cheap)' },
    { value: 'claude-sonnet-4-5',  label: 'Claude Sonnet 4.5 (balanced)' },
  ],
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (fast, cheap)' },
    { value: 'gpt-4o',      label: 'GPT-4o (most capable)' },
  ],
}

export function SettingsPage() {
  const qc = useQueryClient()
  const [provider, setProvider] = useState('gemini')
  const [model, setModel]       = useState('gemini-2.5-flash')
  const [limit, setLimit]       = useState('500')
  const [maxDevices, setMaxDevices] = useState('3')
  const [appVersion, setAppVersion] = useState('')
  const [apkUrl, setApkUrl]         = useState('')
  const [saved, setSaved]       = useState(false)

  const { data: settings = [] } = useQuery<AppSetting[]>({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('key, value')
      if (error) throw error
      return data
    },
  })

  useEffect(() => {
    const map = Object.fromEntries(settings.map(s => [s.key, s.value]))
    if (map['ai_provider'])            setProvider(map['ai_provider'])
    if (map['ai_model']) {
      let m = map['ai_model']
      const prov = map['ai_provider'] ?? 'gemini'
      if (prov === 'gemini') {
        const legacy: Record<string, string> = {
          'gemini-2.0-flash': 'gemini-2.5-flash',
          'gemini-2.0-flash-thinking': 'gemini-2.5-flash',
          'gemini-1.5-pro': 'gemini-2.5-pro',
        }
        if (legacy[m]) m = legacy[m]
      }
      setModel(m)
    }
    if (map['queries_per_agent_limit']) setLimit(map['queries_per_agent_limit'])
    if (map['max_devices_per_agent'])   setMaxDevices(map['max_devices_per_agent'])
    if (map['app_latest_version'])      setAppVersion(map['app_latest_version'])
    if (map['app_apk_url'] !== undefined) setApkUrl(map['app_apk_url'])
  }, [settings])

  const saveSettings = useMutation({
    mutationFn: async () => {
      const updates = [
        { key: 'ai_provider',            value: provider },
        { key: 'ai_model',               value: model },
        { key: 'queries_per_agent_limit', value: limit },
        { key: 'max_devices_per_agent',   value: maxDevices },
        { key: 'app_latest_version',      value: appVersion },
        { key: 'app_apk_url',             value: apkUrl },
      ]
      for (const u of updates) {
        const { error } = await supabase
          .from('app_settings')
          .upsert(u, { onConflict: 'key' })
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['app-settings'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  function handleProviderChange(p: string) {
    setProvider(p)
    setModel(MODELS[p]?.[0]?.value ?? '')
  }

  const estimatedCost = (() => {
    const costPer1k: Record<string, number> = {
      'gemini-2.5-flash':      0.0001,
      'gemini-2.5-flash-lite': 0.00005,
      'gemini-2.5-pro':        0.002,
      'gemini-2.0-flash':      0.0001,
      'gemini-1.5-pro':        0.00125,
      'claude-haiku-4-5': 0.0008,
      'claude-sonnet-4-5':0.003,
      'gpt-4o-mini':      0.00015,
      'gpt-4o':           0.005,
    }
    const ratePerQuery = (costPer1k[model] ?? 0.001) * 0.5
    const monthly      = parseInt(limit, 10) * 4 * ratePerQuery
    return monthly.toFixed(2)
  })()

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Configure the AI provider for all agents. Changes take effect immediately.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-ambient p-6 space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">AI Provider</label>
          <div className="grid grid-cols-3 gap-3">
            {PROVIDERS.map(p => (
              <button
                key={p.value}
                onClick={() => handleProviderChange(p.value)}
                className={`rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                  provider === p.value
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Model</label>
          <select
            value={model}
            onChange={e => setModel(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {(MODELS[provider] ?? []).map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Monthly query limit per agent</label>
            <input
              type="number" min="50" max="10000" value={limit}
              onChange={e => setLimit(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Max devices per agent</label>
            <input
              type="number" min="1" max="10" value={maxDevices}
              onChange={e => setMaxDevices(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm">
          <p className="font-medium text-blue-800">Estimated monthly cost (4 agents)</p>
          <p className="text-blue-700 mt-1">≈ <strong>${estimatedCost}</strong> at {limit} queries/agent/month using {model}</p>
          <p className="text-blue-500 text-xs mt-1">Based on ~500 tokens per query average</p>
        </div>

        <button
          onClick={() => saveSettings.mutate()}
          disabled={saveSettings.isPending}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg px-5 py-2.5 transition-colors"
        >
          <Save size={15} />
          {saveSettings.isPending ? 'Saving…' : saved ? 'Saved!' : 'Save Settings'}
        </button>

        {saveSettings.error && (
          <p className="text-sm text-red-600">{(saveSettings.error as Error).message}</p>
        )}
      </div>

      {/* ── Mobile App Update ─────────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-bold text-gray-900">Mobile App Update</h2>
        <p className="text-sm text-gray-500 mt-1">Upload a new APK to any file host (e.g. Supabase Storage), paste the public URL here, and bump the version. Agents will see an update prompt on next app open.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-ambient p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Latest app version</label>
            <input
              type="text" placeholder="e.g. 1.2.0" value={appVersion}
              onChange={e => setAppVersion(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">APK download URL</label>
            <input
              type="url" placeholder="https://..." value={apkUrl}
              onChange={e => setApkUrl(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
        <p className="text-xs text-gray-400">The app checks this on startup. To push an update: build a new APK → upload it → paste the URL above → bump the version → Save.</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <p className="font-semibold mb-1">API Key Setup</p>
        <p>Keys must be set as Supabase Edge Function secrets — never in code. In the Supabase Dashboard go to Edge Functions → Secrets and add:</p>
        <ul className="mt-2 space-y-1 font-mono text-xs">
          <li>GEMINI_API_KEY — from console.cloud.google.com or aistudio.google.com</li>
          <li>CLAUDE_API_KEY — from console.anthropic.com</li>
          <li>OPENAI_API_KEY — from platform.openai.com</li>
        </ul>
      </div>
    </div>
  )
}
