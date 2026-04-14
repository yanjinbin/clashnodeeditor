import { useEffect, useState } from 'react'

const POLL_INTERVAL = 5 * 60 * 1000 // 5 min
const COUNTDOWN_SEC = 5

export function useVersionCheck() {
  const [needsUpdate, setNeedsUpdate] = useState(false)
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC)

  // Poll /version.json — skip entirely in dev
  useEffect(() => {
    if (import.meta.env.DEV) return

    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json() as { buildTime: string }
        if (data.buildTime !== __BUILD_TIME__) setNeedsUpdate(true)
      } catch { /* network error — ignore */ }
    }

    check()
    const id = setInterval(check, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [])

  // Countdown then force reload
  useEffect(() => {
    if (!needsUpdate) return
    if (countdown <= 0) { window.location.reload(); return }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [needsUpdate, countdown])

  return { needsUpdate, countdown, reloadNow: () => window.location.reload() }
}
