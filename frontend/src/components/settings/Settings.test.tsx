import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Settings } from './Settings'
import * as Api from '../../lib/api'

vi.mock('../../lib/api', () => ({
  GetConfig: vi.fn().mockResolvedValue({
    outputDirectory: '',
    videoQuality: 'best',
    audioSourcePriority: ['tidal', 'qobuz', 'amazon'],
    namingTemplate: 'jellyfin',
    generateNfo: true,
    concurrentDownloads: 2,
    embedCoverArt: true,
    theme: 'system',
    cookiesBrowser: '',
    accentColor: 'pink',
    soundEffectsEnabled: true,
    soundVolume: 70,
    lyricsEnabled: false,
    lyricsEmbedMode: 'lrc',
    logLevel: 'info',
    proxyUrl: '',
    downloadTimeoutMinutes: 10,
    preferredQuality: 'highest',
    generateM3u8: false,
    skipExplicit: false,
    saveCoverFile: false,
    firstArtistOnly: false,
    artistSeparator: '; ',
    autoQualityFallback: true,
    searchResultsLimit: 10,
    qobuzAppId: '',
    qobuzAppSecret: '',
    qobuzUserToken: '',
  }),
  SaveConfig: vi.fn().mockResolvedValue(undefined),
  GetDefaultOutputDirectory: vi.fn().mockResolvedValue('/home/user/MusicVideos'),
  OpenConfigFolder: vi.fn().mockResolvedValue(undefined),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Settings', () => {
  it('renders without crashing', async () => {
    render(<Settings />)
    // Shows loading initially, then Settings header
    // Just verify it doesn't throw and mounts
    expect(document.body).toBeTruthy()
  })

  it('shows unsaved changes modal when pendingNavigate is set', () => {
    const onResolvePending = vi.fn()
    render(
      <Settings
        pendingNavigate="home"
        onResolvePending={onResolvePending}
        onRegisterGuard={vi.fn()}
      />
    )
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    expect(screen.getByText('You have unsaved changes. Leave anyway?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Leave' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stay' })).toBeInTheDocument()
  })

  it('calls onResolvePending(true) when Leave is clicked', () => {
    const onResolvePending = vi.fn()
    render(
      <Settings
        pendingNavigate="home"
        onResolvePending={onResolvePending}
        onRegisterGuard={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }))
    expect(onResolvePending).toHaveBeenCalledWith(true)
  })

  it('calls onResolvePending(false) when Stay is clicked', () => {
    const onResolvePending = vi.fn()
    render(
      <Settings
        pendingNavigate="home"
        onResolvePending={onResolvePending}
        onRegisterGuard={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }))
    expect(onResolvePending).toHaveBeenCalledWith(false)
  })
})
