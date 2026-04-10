import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChannelDownloadModal } from './ChannelDownloadModal'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

beforeEach(() => {
  mockFetch.mockReset()
})

describe('ChannelDownloadModal', () => {
  const baseProps = {
    url: 'https://www.youtube.com/@Test',
    open: true,
    onClose: vi.fn(),
    onTracksResolved: vi.fn(),
  }

  it('renders when open=true', () => {
    render(<ChannelDownloadModal {...baseProps} />)
    expect(screen.getByText(/Download Discography/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Fetch/i })).toBeInTheDocument()
  })

  it('does not render when open=false', () => {
    render(<ChannelDownloadModal {...baseProps} open={false} />)
    expect(screen.queryByText(/Download Discography/i)).not.toBeInTheDocument()
  })

  it('posts to /api/channel/fetch on Fetch click', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobID: 'abc123' }),
    })
    render(<ChannelDownloadModal {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: /Fetch/i }))
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/channel/fetch',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  it('calls onClose when Close is clicked', () => {
    const onClose = vi.fn()
    render(<ChannelDownloadModal {...baseProps} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /Close/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
