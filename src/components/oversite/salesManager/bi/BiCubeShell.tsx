import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { BiBadge } from './BiBadge'

export function BiCubeShell({
  title,
  helpText,
  children,
}: {
  title: string
  helpText?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="sm-cube bi-cube">
      <div className="sm-cube-title bi-cube-title">
        <span className="bi-cube-title-main">
          <span>{title}</span>
          {helpText ? (
            <span className="bi-help explain-popover" ref={rootRef}>
              <button
                type="button"
                className="bi-help-btn"
                aria-label="Help"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpen(o => !o)}
              >
                ?
              </button>
              {open ? (
                <div id={panelId} className="explain-popover-body bi-help-body" role="dialog">
                  <p className="bi-help-text">{helpText}</p>
                </div>
              ) : null}
            </span>
          ) : null}
        </span>
        <BiBadge />
      </div>
      {children}
    </div>
  )
}
