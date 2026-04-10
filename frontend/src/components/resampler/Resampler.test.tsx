import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Resampler } from './Resampler'
import * as Api from '../../lib/api'

vi.mock('../../lib/api', () => ({
  Resample: vi.fn(),
}))

describe('Resampler', () => {
  it('renders the form', () => {
    render(<Resampler />)
    expect(screen.getByText(/Audio Resampler/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Resample/i })).toBeInTheDocument()
  })

  it('shows result card on success', async () => {
    vi.mocked(Api.Resample).mockResolvedValueOnce({
      success: true, outputPath: '/out/test.flac',
      inputRate: 44100, outputRate: 96000, durationMs: 250,
    })
    render(<Resampler />)
    fireEvent.change(screen.getByPlaceholderText(/input/i), { target: { value: '/in/test.wav' } })
    fireEvent.change(screen.getByPlaceholderText(/output/i), { target: { value: '/out/test.flac' } })
    fireEvent.click(screen.getByRole('button', { name: /Resample/i }))
    await waitFor(() => {
      expect(screen.getByText(/44\.1 kHz → 96\.0 kHz/i)).toBeInTheDocument()
    })
  })
})
