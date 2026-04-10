import { useState, useRef, useCallback, useEffect } from 'react'

export interface VideoInfoLite {
  id: string
  title: string
  duration: number
  upload_date: string
  is_short: boolean
  thumbnail: string
}

export type FetchStatus = 'idle' | 'running' | 'done' | 'cancelled' | 'error'

export interface ChannelFetchOpts {
  includeShorts?: boolean
  onlyLongForm?: boolean
  playlistID?: string
  maxItems?: number
}

export function useChannelFetch() {
  const [status, setStatus] = useState<FetchStatus>('idle')
  const [items, setItems] = useState<VideoInfoLite[]>([])
  const [count, setCount] = useState(0)
  const jobIDRef = useRef<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  useEffect(() => () => cleanup(), [cleanup])

  const start = useCallback(async (url: string, opts: ChannelFetchOpts = {}) => {
    cleanup()
    setItems([])
    setCount(0)
    setStatus('running')

    const resp = await fetch('/api/channel/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, ...opts }),
    })
    if (!resp.ok) {
      setStatus('error')
      return
    }
    const { jobID } = await resp.json()
    jobIDRef.current = jobID

    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.jobID !== jobID) return
        if (msg.type === 'channel_fetch_progress') {
          setCount(msg.count)
          if (msg.item) setItems(prev => [...prev, msg.item])
        } else if (msg.type === 'channel_fetch_done') {
          setStatus('done')
          cleanup()
        }
      } catch {}
    }

    ws.onerror = () => setStatus('error')
  }, [cleanup])

  const cancel = useCallback(async () => {
    if (!jobIDRef.current) return
    await fetch(`/api/channel/fetch/${jobIDRef.current}/cancel`, { method: 'POST' })
    setStatus('cancelled')
    cleanup()
  }, [cleanup])

  return { start, cancel, items, status, count }
}
