import { useState, useRef, useCallback, useEffect } from 'react'
import * as Api from '../lib/api'
import { EventsOn } from '../lib/websocket'

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
  const unsubRef = useRef<(() => void) | null>(null)

  const cleanup = useCallback(() => {
    if (unsubRef.current) {
      unsubRef.current()
      unsubRef.current = null
    }
  }, [])

  useEffect(() => () => cleanup(), [cleanup])

  const start = useCallback(async (url: string, opts: ChannelFetchOpts = {}) => {
    cleanup()
    setItems([])
    setCount(0)
    setStatus('running')

    let jobID: string
    try {
      jobID = await Api.ChannelFetch(
        url,
        opts.includeShorts ?? false,
        opts.onlyLongForm ?? false,
        opts.playlistID ?? '',
        opts.maxItems ?? 0
      )
    } catch {
      setStatus('error')
      return
    }
    jobIDRef.current = jobID

    const unsubProgress = EventsOn('channel_fetch_progress', (msg: any) => {
      if (msg.jobID !== jobID) return
      setCount(msg.count)
      if (msg.item) setItems(prev => [...prev, msg.item])
    })
    const unsubDone = EventsOn('channel_fetch_done', (msg: any) => {
      if (msg.jobID !== jobID) return
      setStatus('done')
      cleanup()
    })
    unsubRef.current = () => {
      unsubProgress()
      unsubDone()
    }
  }, [cleanup])

  const cancel = useCallback(async () => {
    if (!jobIDRef.current) return
    await Api.ChannelFetchCancel(jobIDRef.current)
    setStatus('cancelled')
    cleanup()
  }, [cleanup])

  return { start, cancel, items, status, count }
}
