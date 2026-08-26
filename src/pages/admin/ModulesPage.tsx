import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from '../../context/LocaleContext'
import { useBiConfig, useBiModulesCatalog } from '../../hooks/useBiModules'
import { useUiModuleCatalog } from '../../hooks/useUiModules'
import { upsertBiConfig } from '../../lib/biModulesApi'
import { validateHabitXY } from '../../lib/biModules'

export function ModulesPage() {
  const { t } = useLocale()
  const qc = useQueryClient()
  const uiCatalog = useUiModuleCatalog()
  const biCatalog = useBiModulesCatalog()
  const biConfig = useBiConfig()

  const [habitX, setHabitX] = useState(3)
  const [habitY, setHabitY] = useState(4)
  const [formError, setFormError] = useState<string | null>(null)
  const [savedNotice, setSavedNotice] = useState<string | null>(null)

  useEffect(() => {
    if (biConfig.data) {
      setHabitX(biConfig.data.habitX)
      setHabitY(biConfig.data.habitY)
    }
  }, [biConfig.data])

  useEffect(() => {
    if (!savedNotice) return
    const id = window.setTimeout(() => setSavedNotice(null), 3000)
    return () => window.clearTimeout(id)
  }, [savedNotice])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const err = validateHabitXY(habitX, habitY)
      if (err) throw new Error(err)
      await upsertBiConfig(habitX, habitY)
    },
    onSuccess: () => {
      setFormError(null)
      setSavedNotice(t('admin.modulesHabitSaved'))
      qc.invalidateQueries({ queryKey: ['bi-config'] })
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const uiModules = (uiCatalog.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
  const biModules = (biCatalog.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))

  if (uiCatalog.isLoading || biCatalog.isLoading || biConfig.isLoading) {
    return <p className="status-msg">{t('common.loading')}</p>
  }

  return (
    <div>
      <div className="ov-header">
        <h2>{t('admin.modulesPageTitle')}</h2>
        <p className="ov-sub">{t('admin.modulesPageSub')}</p>
      </div>

      <section className="admin-modules-section">
        <h3 className="admin-form-section-title">{t('admin.modulesUiSection')}</h3>
        <p className="ov-sub" style={{ marginBottom: 8 }}>
          {t('admin.modulesUiHint')}
        </p>
        <div className="ov-table-wrap">
          <table className="ov-table">
            <thead>
              <tr>
                <th>{t('admin.modulesColId')}</th>
                <th>{t('admin.modulesColLabel')}</th>
                <th>{t('admin.modulesColSurface')}</th>
                <th>{t('admin.modulesColKind')}</th>
                <th>{t('admin.modulesColActive')}</th>
              </tr>
            </thead>
            <tbody>
              {uiModules.length === 0 ? (
                <tr>
                  <td colSpan={5}>{t('admin.modulesEmpty')}</td>
                </tr>
              ) : (
                uiModules.map(m => (
                  <tr key={m.id}>
                    <td>
                      <code>{m.id}</code>
                    </td>
                    <td>{m.label}</td>
                    <td>{m.surface}</td>
                    <td>{m.kind}</td>
                    <td>{m.active ? t('common.yes') : t('common.no')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-modules-section" style={{ marginTop: 28 }}>
        <h3 className="admin-form-section-title">{t('admin.modulesBiSection')}</h3>
        <p className="ov-sub" style={{ marginBottom: 8 }}>
          {t('admin.modulesBiHint')}
        </p>
        <div className="ov-table-wrap">
          <table className="ov-table">
            <thead>
              <tr>
                <th>{t('admin.modulesColId')}</th>
                <th>{t('admin.modulesColLabel')}</th>
                <th>{t('admin.modulesColDesc')}</th>
                <th>{t('admin.modulesColNeedsAgent')}</th>
                <th>{t('admin.modulesColHabit')}</th>
                <th>{t('admin.modulesColActive')}</th>
              </tr>
            </thead>
            <tbody>
              {biModules.length === 0 ? (
                <tr>
                  <td colSpan={6}>{t('admin.modulesEmpty')}</td>
                </tr>
              ) : (
                biModules.map(m => (
                  <tr key={m.id}>
                    <td>
                      <code>{m.id}</code>
                    </td>
                    <td>{m.label}</td>
                    <td>{m.description ?? '—'}</td>
                    <td>{m.needsAgent}</td>
                    <td>{m.usesHabit ? t('common.yes') : t('common.no')}</td>
                    <td>{m.active ? t('common.yes') : t('common.no')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="admin-form" style={{ marginTop: 16, maxWidth: 420 }}>
          <div className="admin-form-section-title">{t('admin.modulesHabitTitle')}</div>
          <p className="ov-sub" style={{ marginBottom: 8, fontSize: '.72rem' }}>
            {t('admin.modulesHabitHint')}
          </p>
          {formError && (
            <p className="status-msg error" style={{ margin: '0 0 8px' }}>
              {formError}
            </p>
          )}
          {savedNotice && (
            <p className="status-msg" style={{ margin: '0 0 8px' }}>
              {savedNotice}
            </p>
          )}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label>
              X
              <input
                className="sbar-search block-input"
                type="number"
                min={1}
                max={24}
                value={habitX}
                onChange={e => setHabitX(Number(e.target.value))}
              />
            </label>
            <label>
              Y
              <input
                className="sbar-search block-input"
                type="number"
                min={1}
                max={24}
                value={habitY}
                onChange={e => setHabitY(Number(e.target.value))}
              />
            </label>
            <button
              type="button"
              className="ov-toggle-btn"
              style={{ marginTop: 0, width: 'auto' }}
              disabled={saveMutation.isPending}
              onClick={() => {
                const err = validateHabitXY(habitX, habitY)
                if (err) {
                  setFormError(err)
                  return
                }
                saveMutation.mutate()
              }}
            >
              {saveMutation.isPending ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
