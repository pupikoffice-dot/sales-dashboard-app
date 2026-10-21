import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../context/LocaleContext'
import type { LogicalCompany } from '../../types/dashboard'

export interface JumpCompany {
  id: LogicalCompany
  label: string
  accentColor: string
}

/** Element id of one company's column on the Oversight page (the jump bar scrolls to it). */
export function companyAnchorId(id: string): string {
  return `ov-co-${id}`
}

/**
 * A row of buttons, one per company on screen, that jumps straight to that company's column instead of scrolling
 * past the ones above it. It sticks under the page header (measured, because the header gets taller on phones).
 * Shown only when two or more companies are on screen.
 */
export function OversightCompanyJump({ companies }: { companies: JumpCompany[] }) {
  const { t } = useLocale()
  const barRef = useRef<HTMLElement | null>(null)
  const [top, setTop] = useState(0)

  useEffect(() => {
    const header = document.querySelector<HTMLElement>('.dashboard-header')
    if (!header) return
    const measure = () => setTop(Math.round(header.getBoundingClientRect().height))
    measure()
    window.addEventListener('resize', measure)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(header)
    return () => {
      window.removeEventListener('resize', measure)
      ro?.disconnect()
    }
  }, [])

  if (companies.length < 2) return null

  function jump(id: string) {
    const el = document.getElementById(companyAnchorId(id))
    if (!el) return
    const barH = barRef.current?.getBoundingClientRect().height ?? 0
    const y = el.getBoundingClientRect().top + window.scrollY - top - barH - 8
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: Math.max(0, y), behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <nav ref={barRef} className="ov-jump" style={{ top }} aria-label={t('oversite.jumpTo')}>
      {companies.map(c => (
        <button key={c.id} type="button" className="ov-jump-btn" onClick={() => jump(c.id)}>
          <i className="ov-jump-dot" style={{ background: c.accentColor }} aria-hidden="true" />
          {c.label}
        </button>
      ))}
    </nav>
  )
}
