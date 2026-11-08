import { useEffect, useRef, useState } from 'react'

import { fmtDate, maskDmy, parseDmy } from '../lib/dates'

interface Props {
  /** 'YYYY-MM-DD', or '' for no date */
  value: string
  onChange: (iso: string) => void
  min?: string
  max?: string
  className?: string
  'aria-label'?: string
  disabled?: boolean
}

/**
 * A date field that always reads and shows DD/MM/YYYY (a native date input follows the browser's locale, so it showed
 * MM/DD/YYYY on some machines). You can type the date (slashes are added for you) or click the calendar button, which opens
 * the browser's picker; either way the value handed back is 'YYYY-MM-DD'. An impossible date or one outside min/max is
 * marked and not passed on.
 */
export function DateField({ value, onChange, min, max, className, disabled, ...rest }: Props) {
  const [text, setText] = useState(fmtDate(value))
  const [bad, setBad] = useState(false)
  const picker = useRef<HTMLInputElement>(null)

  // The value changed from outside (reset, preset buttons): show it.
  useEffect(() => {
    setText(fmtDate(value))
    setBad(false)
  }, [value])

  function commit(raw: string) {
    if (raw.trim() === '') {
      setBad(false)
      if (value !== '') onChange('')
      return
    }
    const iso = parseDmy(raw)
    if (!iso || (min && iso < min) || (max && iso > max)) {
      setBad(true)
      return
    }
    setBad(false)
    if (iso !== value) onChange(iso)
  }

  function openPicker() {
    const el = picker.current
    if (!el || disabled) return
    try {
      el.showPicker()
    } catch {
      el.focus()
      el.click()
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      <input
        type="text"
        inputMode="numeric"
        className={className}
        value={text}
        placeholder="DD/MM/YYYY"
        maxLength={10}
        disabled={disabled}
        aria-label={rest['aria-label']}
        aria-invalid={bad || undefined}
        style={{ width: '9.5em', ...(bad ? { outline: '1px solid #e5484d' } : null) }}
        onChange={e => {
          const masked = maskDmy(e.target.value)
          setText(masked)
          if (masked.length === 10) commit(masked)
          else setBad(false)
        }}
        onBlur={() => commit(text)}
        onKeyDown={e => {
          if (e.key === 'Enter') commit(text)
        }}
      />
      <button type="button" className="sbar-search" aria-label="Calendar" disabled={disabled} onClick={openPicker} style={{ padding: '2px 6px' }}>
        📅
      </button>
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
      />
    </span>
  )
}
