import { useState } from 'react'
import * as Api from '../../lib/api'
import type { ResampleOptions, ResampleResult } from '../../lib/api'

const SAMPLE_RATES = [44100, 48000, 88200, 96000, 176400, 192000]
const BIT_DEPTHS = [16, 24, 32]
const FORMATS = ['flac', 'wav', 'alac'] as const

export function Resampler() {
  const [opts, setOpts] = useState<ResampleOptions>({
    inputPath: '', outputPath: '', sampleRate: 44100, bitDepth: 16, dither: false, format: 'flac',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ResampleResult | null>(null)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await Api.Resample(opts)
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Resample failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen">
      <div className="px-4 md:px-8 py-8 max-w-2xl">
        <h1 className="text-2xl font-semibold mb-6" style={{ color: 'var(--color-text-primary)' }}>Audio Resampler</h1>
        <div className="card p-6 space-y-4">
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Input file path</label>
            <input className="w-full px-3 py-2 rounded text-sm" style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
              value={opts.inputPath} onChange={e => setOpts((o: ResampleOptions) => ({ ...o, inputPath: e.target.value }))} placeholder="/path/to/input.wav" />
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Output file path</label>
            <input className="w-full px-3 py-2 rounded text-sm" style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
              value={opts.outputPath} onChange={e => setOpts((o: ResampleOptions) => ({ ...o, outputPath: e.target.value }))} placeholder="/path/to/output.flac" />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Sample rate</label>
              <select className="w-full px-3 py-2 rounded text-sm" style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
                value={opts.sampleRate} onChange={e => setOpts((o: ResampleOptions) => ({ ...o, sampleRate: Number(e.target.value) }))}>
                {SAMPLE_RATES.map(r => <option key={r} value={r}>{(r / 1000).toFixed(1)} kHz</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Bit depth</label>
              <select className="w-full px-3 py-2 rounded text-sm" style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
                value={opts.bitDepth} onChange={e => setOpts((o: ResampleOptions) => ({ ...o, bitDepth: Number(e.target.value) }))}>
                {BIT_DEPTHS.map(d => <option key={d} value={d}>{d}-bit</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Format</label>
              <select className="w-full px-3 py-2 rounded text-sm" style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
                value={opts.format} onChange={e => setOpts((o: ResampleOptions) => ({ ...o, format: e.target.value as 'flac' | 'wav' | 'alac' }))}>
                {FORMATS.map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <input type="checkbox" checked={opts.dither} onChange={e => setOpts((o: ResampleOptions) => ({ ...o, dither: e.target.checked }))} />
            Triangular dither (recommended when downsampling)
          </label>
          <button className="btn btn-primary w-full" onClick={handleSubmit} disabled={loading || !opts.inputPath || !opts.outputPath}>
            {loading ? 'Resampling…' : 'Resample'}
          </button>
          {error && <p className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</p>}
          {result && (
            <div className="card p-4 space-y-1" style={{ background: 'var(--color-bg-tertiary)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {(result.inputRate / 1000).toFixed(1)} kHz → {(result.outputRate / 1000).toFixed(1)} kHz
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{result.outputPath}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{result.durationMs} ms</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
