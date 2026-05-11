import { useCallback, useEffect, useState } from 'react'
import { checkAppVersion, type VersionCheckResult } from '../utils/versionCheck'

const POLL_INTERVAL = 30 * 60 * 1000 // 30 min
const COUNTDOWN_SEC = 5

export function useVersionCheck() {
  const [needsUpdate, setNeedsUpdate] = useState(false)
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC)
  const [isChecking, setIsChecking] = useState(false)

  const checkNow = useCallback(async (): Promise<VersionCheckResult> => {
    setIsChecking(true)
    try {
      const result = await checkAppVersion({
        currentBuildTime: __BUILD_TIME__,
        skip: import.meta.env.DEV,
        fetchVersion: async () => {
          const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return await res.json() as { buildTime?: string }
        },
      })
      if (result === 'updated') {
        setCountdown(COUNTDOWN_SEC)
        setNeedsUpdate(true)
      }
      return result
    } finally {
      setIsChecking(false)
    }
  }, [])

  // Poll /version.json — skip entirely in dev
  useEffect(() => {
    if (import.meta.env.DEV) return
    checkNow()
    const id = setInterval(checkNow, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [checkNow])

  // Countdown then force reload
  useEffect(() => {
    if (!needsUpdate) return
    if (countdown <= 0) { window.location.reload(); return }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [needsUpdate, countdown])

  return { needsUpdate, countdown, isChecking, checkNow, reloadNow: () => window.location.reload() }
}
