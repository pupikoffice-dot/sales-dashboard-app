import { useLocale } from '../../context/LocaleContext'
import type { OversightLayoutPreference } from '../../lib/oversightLayouts'

export type OversightLayoutOption = 'classic' | { suiteId: string }

export interface OversightLayoutToggleProps {
  /** 'classic' or the active suite id (e.g. 'sales_manager', 'hub'). */
  active: string
  /** Layouts this user may switch between (from useOversightLayout().options). */
  options?: OversightLayoutOption[]
  onSelect: (preference: OversightLayoutPreference) => void
}

const DEFAULT_OPTIONS: OversightLayoutOption[] = ['classic', { suiteId: 'sales_manager' }]

/** Classic / Sales Manager / Hub layout switch (only shown when more than one layout is granted). */
export function OversightLayoutToggle({ active, options = DEFAULT_OPTIONS, onSelect }: OversightLayoutToggleProps) {
  const { t } = useLocale()
  const label = (id: string) =>
    id === 'classic'
      ? t('oversite.layout.classic')
      : id === 'hub'
        ? t('oversite.layout.hub')
        : id === 'sales_manager'
          ? t('oversite.layout.salesManager')
          : id
  return (
    <div className="sm-mode-toggle" role="group" aria-label={t('oversite.layout.label')}>
      {options.map(o => {
        const id = o === 'classic' ? 'classic' : o.suiteId
        return (
          <button
            key={id}
            type="button"
            className={active === id ? 'active' : undefined}
            aria-pressed={active === id}
            onClick={() => onSelect(o === 'classic' ? 'classic' : { suiteId: o.suiteId })}
          >
            {label(id)}
          </button>
        )
      })}
    </div>
  )
}
