import { useEffect } from 'react'
import { useLocale } from '../../context/LocaleContext'
import { usePreview } from '../../context/PreviewContext'

/**
 * Always-visible bar shown while a super admin is viewing the app as another
 * user. Deliberately loud: paired with the `preview-mode` ring on the shell it
 * makes it impossible to mistake a preview for one's own view.
 *
 * Rendered ABOVE DashboardLayout's early returns so that previewing a user who
 * is inactive / has no access still leaves Exit reachable.
 */
export function PreviewBanner() {
  const { isPreviewing, previewUser, stopPreview } = usePreview()
  const { t, dir } = useLocale()

  useEffect(() => {
    document.body.classList.toggle('preview-mode', isPreviewing)
    return () => document.body.classList.remove('preview-mode')
  }, [isPreviewing])

  if (!isPreviewing || !previewUser) return null

  return (
    <div className={`preview-banner${dir === 'rtl' ? ' is-rtl' : ''}`} role="status">
      <span className="preview-banner-text">
        👁 {t('preview.viewingAs')} <b>{previewUser.name}</b>
        <span className="preview-banner-login">{previewUser.login}</span>
        <span className="preview-banner-chip">{t('preview.readOnly')}</span>
      </span>
      <button type="button" className="preview-banner-exit" onClick={stopPreview}>
        {t('preview.exit')}
      </button>
    </div>
  )
}
