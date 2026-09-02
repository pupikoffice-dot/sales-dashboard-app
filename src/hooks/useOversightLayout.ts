import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { usePreview } from '../context/PreviewContext'
import {
  readOversightLayoutPreference,
  resolveOversightDisplay,
  writeOversightLayoutPreference,
  type OversightLayoutPreference,
} from '../lib/oversightLayouts'
import { useOversightLayoutGrants } from './useOversightLayoutGrants'
import { useResolvedOversightMode } from './useResolvedOversightMode'

/** Effective user id for View-as: preview target, else signed-in user. */
function useEffectiveUserId(): string | null {
  const { session } = useAuth()
  const { isPreviewing, previewUser } = usePreview()
  if (isPreviewing && previewUser) return previewUser.id
  return session?.user.id ?? null
}

/**
 * Class layout + optional per-user Sales Manager toggle.
 * When both classic and suite are available, default is classic.
 */
export function useOversightLayout() {
  const userId = useEffectiveUserId()
  const classMode = useResolvedOversightMode()
  const grantsQ = useOversightLayoutGrants(userId)

  const [preference, setPreferenceState] = useState<OversightLayoutPreference | null>(null)

  useEffect(() => {
    setPreferenceState(userId ? readOversightLayoutPreference(userId) : null)
  }, [userId])

  const classSuiteId = classMode.mode === 'suite' ? classMode.suiteId : null
  const classAddonKey =
    classMode.mode === 'classic' ? classMode.addonIds.join(',') : ''

  const resolved = useMemo(
    () =>
      resolveOversightDisplay({
        classMode:
          classSuiteId != null
            ? { mode: 'suite', suiteId: classSuiteId }
            : { mode: 'classic', addonIds: classAddonKey ? classAddonKey.split(',') : [] },
        alternateLayoutIds: grantsQ.data ?? [],
        preference,
      }),
    [classSuiteId, classAddonKey, grantsQ.data, preference],
  )

  const setPreference = useCallback(
    (next: OversightLayoutPreference) => {
      setPreferenceState(next)
      if (userId) writeOversightLayoutPreference(userId, next)
    },
    [userId],
  )

  return {
    isLoading:
      classMode.isLoading ||
      (!!userId && grantsQ.isPending),
    display: resolved.display,
    canToggle: resolved.canToggle,
    options: resolved.options,
    setPreference,
  }
}
