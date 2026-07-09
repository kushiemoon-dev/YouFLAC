import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChannelDownloadModal } from './ChannelDownloadModal'
import * as Api from '../../lib/api'

vi.mock('../../lib/api', () => ({
  ChannelFetch: vi.fn(),
  ChannelFetchCancel: vi.fn(),
}))

vi.mock('../../lib/websocket', () => ({
  EventsOn: vi.fn(() => () => {}),
}))

beforeEach(() => {
  vi.clearAllMocks()
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

  it('calls ChannelFetch on Fetch click', async () => {
    vi.mocked(Api.ChannelFetch).mockResolvedValueOnce('abc123')
    render(<ChannelDownloadModal {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: /Fetch/i }))
    await waitFor(() => {
      expect(Api.ChannelFetch).toHaveBeenCalledWith(
        baseProps.url, false, false, '', 0
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
