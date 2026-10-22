import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../context/LocaleContext'
import type { LogicalCompany } from '../../types/dashboard'

export interface JumpCompany {
  id: LogicalCompany
  label: string
  accentColor: string
}

/** One button of a jump bar: where it goes (`anchor` = element id) and what it says. */
export interface JumpTarget {
  anchor: string
  label: string
  /** dot colour; no dot when missing */
  color?: string
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
  return (
    <JumpBar
      ariaLabel={t('oversite.jumpTo')}
      targets={companies.map(c => ({ anchor: companyAnchorId(c.id), label: c.label, color: c.accentColor }))}
    />
  )
}

/** The same sticky bar for any set of anchors (the Hub uses it to jump between its charts). Needs two or more targets. */
export function JumpBar({ targets, ariaLabel }: { targets: JumpTarget[]; ariaLabel: string }) {
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

  if (targets.length < 2) return null

  function jump(anchor: string) {
    const el = document.getElementById(anchor)
    if (!el) return
    const barH = barRef.current?.getBoundingClientRect().height ?? 0
    const y = el.getBoundingClientRect().top + window.scrollY - top - barH - 8
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: Math.max(0, y), behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <nav ref={barRef} className="ov-jump" style={{ top }} aria-label={ariaLabel}>
      {targets.map(c => (
        <button key={c.anchor} type="button" className="ov-jump-btn" onClick={() => jump(c.anchor)}>
          {c.color ? <i className="ov-jump-dot" style={{ background: c.color }} aria-hidden="true" /> : null}
          {c.label}
        </button>
      ))}
    </nav>
  )
}
