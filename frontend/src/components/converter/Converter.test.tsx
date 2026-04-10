import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Converter } from './Converter'
import * as Api from '../../lib/api'

vi.mock('../../lib/api', () => ({
  ConvertAudio: vi.fn(),
  ConvertDirectory: vi.fn(),
  GetAppVersion: vi.fn().mockResolvedValue('0.0.0'),
}))

// Mock WebSocket
class MockWebSocket {
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: Event) => void) | null = null
  onopen: (() => void) | null = null
  close = vi.fn()
  constructor(public url: string) {}
}

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
})

describe('Converter', () => {
  it('renders in file mode by default', () => {
    render(<Converter />)
    expect(screen.getByText('Source File')).toBeInTheDocument()
  })

  it('switches to folder mode when Folder tab clicked', () => {
    render(<Converter />)
    fireEvent.click(screen.getByRole('button', { name: 'Folder' }))
    expect(screen.getByText('Source Directory')).toBeInTheDocument()
  })

  it('Convert button is disabled when source is empty in file mode', () => {
    render(<Converter />)
    const btn = screen.getByRole('button', { name: 'Convert' })
    expect(btn).toBeDisabled()
  })

  it('Convert Folder button is disabled when dir is empty in folder mode', () => {
    render(<Converter />)
    fireEvent.click(screen.getByRole('button', { name: 'Folder' }))
    const btn = screen.getByRole('button', { name: 'Convert Folder' })
    expect(btn).toBeDisabled()
  })

  it('calls ConvertDirectory with dir and format in folder mode', async () => {
    vi.mocked(Api.ConvertDirectory).mockResolvedValueOnce({ success: true, message: 'started' })
    render(<Converter />)
    fireEvent.click(screen.getByRole('button', { name: 'Folder' }))
    fireEvent.change(screen.getByPlaceholderText('/path/to/music/folder'), {
      target: { value: '/music/albums' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Convert Folder' }))
    await waitFor(() => {
      expect(Api.ConvertDirectory).toHaveBeenCalledWith(
        expect.objectContaining({ dir: '/music/albums', targetFormat: 'mp3' })
      )
    })
  })
})
