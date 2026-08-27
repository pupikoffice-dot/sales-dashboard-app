import { useLocale } from '../../context/LocaleContext'
import type { OversightLayoutPreference } from '../../lib/oversightLayouts'

export interface OversightLayoutToggleProps {
  active: 'classic' | 'suite'
  onSelect: (preference: OversightLayoutPreference) => void
  /** Suite id when switching to suite (v1: sales_manager). */
  suiteId?: string
}

/** Classic ↔ Sales Manager layout switch (only when both layouts are granted). */
export function OversightLayoutToggle({
  active,
  onSelect,
  suiteId = 'sales_manager',
}: OversightLayoutToggleProps) {
  const { t } = useLocale()
  return (
    <div className="sm-mode-toggle" role="group" aria-label={t('oversite.layout.label')}>
      <button
        type="button"
        className={active === 'classic' ? 'active' : undefined}
        aria-pressed={active === 'classic'}
        onClick={() => onSelect('classic')}
      >
        {t('oversite.layout.classic')}
      </button>
      <button
        type="button"
        className={active === 'suite' ? 'active' : undefined}
        aria-pressed={active === 'suite'}
        onClick={() => onSelect({ suiteId })}
      >
        {t('oversite.layout.salesManager')}
      </button>
    </div>
  )
}
