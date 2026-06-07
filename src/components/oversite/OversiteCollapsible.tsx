import { useState, type ReactNode } from 'react'

export function OversiteCollapsible({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button type="button" className="ov-toggle-btn" onClick={() => setOpen(v => !v)}>
        {open ? label.replace('▾', '▴') : label}
      </button>
      {open && <div className="ov-drop">{children}</div>}
    </div>
  )
}
