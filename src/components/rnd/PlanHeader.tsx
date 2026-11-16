import { companyLabel } from '../../lib/salesMetrics'
import type { LogicalCompany } from '../../types/dashboard'

export interface HeaderBtn {
  key: string
  label: string
  onClick: () => void
  /** colour family of the button (each kind of action has its own background) */
  kind: 'tab' | 'open' | 'close' | 'edit' | 'hidden' | 'excel'
  /** toggle / selected state (shown darker with a ring) */
  on?: boolean
  disabled?: boolean
  title?: string
}

/** One header row for the R&D planning pages: title, company, then every choice as a bordered, coloured button. */
export function PlanHeader({
  title,
  companyLabelText,
  companies,
  company,
  onCompany,
  buttons,
}: {
  title: string
  companyLabelText: string
  companies: LogicalCompany[]
  company: LogicalCompany
  onCompany: (c: LogicalCompany) => void
  buttons: HeaderBtn[]
}) {
  return (
    <div className="pt-head">
      <h2>{title}</h2>
      <label className="pt-co">
        {companyLabelText}{' '}
        <select value={company} onChange={e => onCompany(e.target.value as LogicalCompany)}>
          {companies.map(c => (
            <option key={c} value={c}>
              {companyLabel(c)}
            </option>
          ))}
        </select>
      </label>
      {buttons.map(b => (
        <button
          key={b.key}
          type="button"
          className={`rb rb-${b.kind}${b.on ? ' on' : ''}`}
          onClick={b.onClick}
          disabled={b.disabled}
          title={b.title}
          aria-pressed={b.on === undefined ? undefined : b.on}
        >
          {b.label}
        </button>
      ))}
    </div>
  )
}
