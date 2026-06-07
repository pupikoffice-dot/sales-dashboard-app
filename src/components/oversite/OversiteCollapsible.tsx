import { useState, type ReactNode } from 'react'

export function OversiteCollapsible({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-center text-xs text-slate-600 transition hover:border-blue-400 hover:text-blue-600"
      >
        {open ? label.replace('▾', '▴') : label}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  )
}
