import { useCallback, useEffect, useRef, useState } from 'react'
import type { Snapshot } from './types'
import { loadSnapshot } from './api'

export function useSnapshot() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(true)
  const [stale, setStale] = useState(false)
  const loadRef = useRef<() => void>(() => {})

  useEffect(() => {
    let alive = true
    let controller: AbortController | null = null
    let hasData = false

    const load = async (manual = false) => {
      controller?.abort()
      controller = new AbortController()
      const current = controller
      const showPending = !hasData || manual
      if (showPending) setPending(true)
      try {
        const next = await loadSnapshot(current.signal)
        if (!alive || current.signal.aborted) return
        hasData = true
        setSnapshot(next)
        setError(null)
        setStale(false)
      } catch (err) {
        if (!alive || current.signal.aborted) return
        if (hasData) setStale(true)
        else setError(err instanceof Error ? err.message : 'No se pudo leer la red de SIATA')
      } finally {
        if (alive && controller === current && showPending) setPending(false)
      }
    }

    loadRef.current = () => {
      void load(true)
    }
    void load()
    const timer = window.setInterval(() => void load(), 60000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      controller?.abort()
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const reload = useCallback(() => loadRef.current(), [])

  return { snapshot, error, pending, stale, reload }
}
