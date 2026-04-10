import { useState } from 'react'
import { useChannelFetch } from '../../hooks/useChannelFetch'
import type { VideoInfoLite } from '../../hooks/useChannelFetch'

interface Props {
  url: string
  open: boolean
  onClose(): void
  onTracksResolved(items: VideoInfoLite[]): void
}

export function ChannelDownloadModal({ url, open, onClose, onTracksResolved }: Props) {
  const { start, cancel, items, status, count } = useChannelFetch()
  const [onlyLongForm, setOnlyLongForm] = useState(false)
  const [includeShorts, setIncludeShorts] = useState(false)
  const [maxItems, setMaxItems] = useState(0)

  if (!open) return null

  const isRunning = status === 'running'
  const isDone = status === 'done'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'var(--color-overlay)' }}
      onClick={onClose}
    >
      <div
        className="card p-6 mx-4 animate-slide-up"
        style={{ maxWidth: 520, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          Download Discography
        </h3>

        <div className="flex flex-col gap-3 mb-4">
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <input type="checkbox" checked={onlyLongForm} onChange={e => setOnlyLongForm(e.target.checked)} />
            Long-form only (≥5 min)
          </label>
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <input type="checkbox" checked={includeShorts} onChange={e => setIncludeShorts(e.target.checked)} />
            Include shorts
          </label>
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Max items:
            <input
              type="number"
              min={0}
              value={maxItems}
              onChange={e => setMaxItems(Number(e.target.value))}
              className="w-20 px-2 py-1 rounded text-sm"
              style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}
            />
            <span style={{ color: 'var(--color-text-secondary)' }}>(0 = unlimited)</span>
          </label>
        </div>

        {isRunning && (
          <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            Fetching… {count} track{count !== 1 ? 's' : ''} found
          </p>
        )}

        {items.length > 0 && (
          <ul className="text-sm mb-4 max-h-40 overflow-y-auto" style={{ color: 'var(--color-text-secondary)' }}>
            {items.map(v => (
              <li key={v.id} className="py-0.5 truncate">{v.title}</li>
            ))}
          </ul>
        )}

        <div className="flex gap-2 justify-end">
          {isRunning ? (
            <button className="btn btn-secondary" onClick={cancel}>Cancel</button>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={onClose}>Close</button>
              {!isDone && (
                <button className="btn btn-primary" onClick={() => start(url, { onlyLongForm, includeShorts, maxItems: maxItems || 0 })}>
                  Fetch
                </button>
              )}
              {isDone && items.length > 0 && (
                <button className="btn btn-primary" onClick={() => { onTracksResolved(items); onClose() }}>
                  Add {items.length} tracks to queue
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
