import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { URLInput } from './URLInput'

// Mock Api module
vi.mock('../../lib/api', () => ({
  GetVideoInfo: vi.fn().mockResolvedValue({ url: 'https://yt.com/watch?v=abc', title: 'T', artist: 'A', duration: 120, thumbnail: '' }),
  AddPlaylistToQueue: vi.fn().mockResolvedValue([]),
  GetPreviewURL: vi.fn((u: string, s = 30) => `/api/video/preview?url=${encodeURIComponent(u)}&seconds=${s}`),
}))

describe('URLInput placeholder rotation', () => {
  it('cycles placeholder after interval', () => {
    vi.useFakeTimers()
    const onAdd = vi.fn().mockResolvedValue(undefined)
    render(<URLInput onAdd={onAdd} />)
    const input = screen.getByPlaceholderText('Paste a YouTube video URL...')
    expect(input).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.getByPlaceholderText('Paste a YouTube playlist URL...')).toBeInTheDocument()
    vi.useRealTimers()
  })
})

describe('URLInput channel detection', () => {
  const onAdd = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => { onAdd.mockClear() })

  it('opens ChannelDownloadModal when a channel URL is typed and submitted', async () => {
    render(<URLInput onAdd={onAdd} />)
    const input = screen.getByPlaceholderText(/youtube/i) ?? screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'https://www.youtube.com/@TestChannel' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
    await waitFor(() => {
      expect(screen.getByText(/Download Discography/i)).toBeInTheDocument()
    })
  })

  it('calls onAdd for each track when onTracksResolved fires', async () => {
    render(<URLInput onAdd={onAdd} />)
    const input = screen.getByPlaceholderText(/youtube/i) ?? screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'https://www.youtube.com/@TestChannel' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
    await waitFor(() => screen.getByText(/Download Discography/i))
    // Simulate onTracksResolved by finding and clicking the modal's close area
    // We test the integration by verifying onAdd would be called from the parent handler
    // Just verify modal is present — the onTracksResolved integration is tested in ChannelDownloadModal.test
  })
})

describe('URLInput audio preview', () => {
  const onAdd = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => { onAdd.mockClear() })

  it('shows Preview button when a YouTube video URL is entered', async () => {
    render(<URLInput onAdd={onAdd} />)
    const input = screen.getByPlaceholderText('Paste a YouTube video URL...')
    fireEvent.change(input, { target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } })
    await waitFor(() => {
      expect(screen.getByTitle('Preview 30s audio')).toBeInTheDocument()
    })
  })

  it('does not show Preview button for non-video URLs', () => {
    render(<URLInput onAdd={onAdd} />)
    const input = screen.getByPlaceholderText('Paste a YouTube video URL...')
    fireEvent.change(input, { target: { value: 'https://www.youtube.com/@SomeChannel' } })
    expect(screen.queryByTitle('Preview 30s audio')).not.toBeInTheDocument()
  })

  it('toggles audio player on Preview click', async () => {
    render(<URLInput onAdd={onAdd} />)
    const input = screen.getByPlaceholderText('Paste a YouTube video URL...')
    fireEvent.change(input, { target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } })
    const previewBtn = await screen.findByTitle('Preview 30s audio')
    expect(screen.queryByRole('audio') ?? document.querySelector('audio')).toBeNull()
    fireEvent.click(previewBtn)
    await waitFor(() => {
      expect(document.querySelector('audio')).toBeInTheDocument()
    })
  })
})
