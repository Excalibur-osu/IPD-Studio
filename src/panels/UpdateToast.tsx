import { useEffect, useState } from 'react'

let doUpdate: (() => Promise<void>) | null = null

/** Unmissable new-version prompt. Fixes the two stale-PWA gaps: the service
 *  worker now re-checks hourly and on tab focus (not only at page load), and
 *  the toast renders in BOTH workspaces (the old status-bar chip never
 *  existed in the HMI). */
export default function UpdateToast() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!import.meta.env.PROD) return
    let iv: number | undefined
    let visListener: (() => void) | null = null
    void import('virtual:pwa-register').then(({ registerSW }) => {
      const update = registerSW({
        onNeedRefresh: () => setReady(true),
        onRegisteredSW: (_url, reg) => {
          if (!reg) return
          const check = () => void reg.update().catch(() => undefined)
          iv = window.setInterval(check, 60 * 60 * 1000)
          visListener = () => { if (!document.hidden) check() }
          document.addEventListener('visibilitychange', visListener)
        },
      })
      doUpdate = () => update(true)
    }).catch(() => undefined)
    return () => {
      if (iv !== undefined) clearInterval(iv)
      if (visListener) document.removeEventListener('visibilitychange', visListener)
    }
  }, [])
  if (!ready) return null
  return (
    <div className="update-toast" role="status">
      <span>⟳ A new version of IPD Studio is ready</span>
      <button onClick={() => void doUpdate?.()}>Reload now</button>
    </div>
  )
}
