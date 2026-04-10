export type URLKind = 'video' | 'playlist' | 'channel' | 'music' | 'unknown'

const CHANNEL_PATTERNS = [
  /youtube\.com\/@[^/?#]+/,
  /youtube\.com\/channel\/UC[^/?#]+/,
  /youtube\.com\/c\/[^/?#]+/,
  /youtube\.com\/user\/[^/?#]+/,
]

const VIDEO_PATTERNS = [
  /youtu\.be\/[^/?#]+/,
  /youtube\.com\/shorts\/[^/?#]+/,
]

const MUSIC_PATTERNS = [
  /open\.spotify\.com\//,
  /tidal\.com\//,
  /music\.youtube\.com\//,
  /deezer\.com\//,
  /music\.apple\.com\//,
]

export function classifyURL(url: string): URLKind {
  if (!url || !url.startsWith('http')) return 'unknown'

  // Music services first (music.youtube.com before youtube.com checks)
  if (MUSIC_PATTERNS.some(p => p.test(url))) return 'music'

  // Channel
  if (CHANNEL_PATTERNS.some(p => p.test(url))) return 'channel'

  // Explicit playlist page
  if (/youtube\.com\/playlist\?.*list=/.test(url)) return 'playlist'

  // watch URL with list= → playlist (regardless of v= presence)
  if (/youtube\.com\/watch\?/.test(url) && /[?&]list=/.test(url)) return 'playlist'

  // Plain video patterns (youtu.be, shorts)
  if (VIDEO_PATTERNS.some(p => p.test(url))) return 'video'

  // watch URL with v= but no list=
  if (/youtube\.com\/watch\?.*[?&]?v=/.test(url)) return 'video'

  return 'unknown'
}
