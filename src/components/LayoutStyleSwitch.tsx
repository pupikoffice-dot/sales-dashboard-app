import { useState } from 'react'
import { useLocale } from '../context/LocaleContext'
import { resolveAppChannel } from '../lib/appChannel'
import {
  applyLayoutStyle,
  LAYOUT_STYLE_IDS,
  isLayoutStyle,
  readStoredLayoutStyle,
  storeLayoutStyle,
  type LayoutStyle,
} from '../lib/layoutStyle'

/** BETA-only preview switch between the current look and the three layout styles. Production never shows it. */
export function LayoutStyleSwitch() {
  const { t } = useLocale()
  const [style, setStyle] = useState<LayoutStyle>(readStoredLayoutStyle)
  if (resolveAppChannel() !== 'beta') return null

  const choose = (value: string) => {
    if (!isLayoutStyle(value)) return
    setStyle(value)
    storeLayoutStyle(value)
    applyLayoutStyle(value)
  }

  return (
    <label className="skin-switch layout-switch" title={t('common.layoutStyle')}>
      <span className="skin-switch-ico" aria-hidden="true">▤</span>
      <select value={style} aria-label={t('common.layoutStyle')} onChange={e => choose(e.target.value)}>
        {LAYOUT_STYLE_IDS.map(id => (
          <option key={id} value={id}>{t(`layout.${id}`)}</option>
        ))}
      </select>
    </label>
  )
}
