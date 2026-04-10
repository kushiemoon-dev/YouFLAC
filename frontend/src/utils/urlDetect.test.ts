import { describe, it, expect } from 'vitest'
import { classifyURL } from './urlDetect'

describe('classifyURL', () => {
  const cases: [string, string][] = [
    // channel URLs
    ['https://www.youtube.com/@Computerphile', 'channel'],
    ['https://www.youtube.com/channel/UCkK9UDm_ZNrq_rIXCz3xCGA', 'channel'],
    ['https://www.youtube.com/c/Computerphile', 'channel'],
    ['https://www.youtube.com/user/Computerphile', 'channel'],
    // playlist URLs
    ['https://www.youtube.com/playlist?list=PLbpi6ZahtOH6Ar_3GPy3workHgiy4', 'playlist'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabc123', 'playlist'],
    // video URLs
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'video'],
    ['https://youtu.be/dQw4w9WgXcQ', 'video'],
    ['https://www.youtube.com/shorts/abc123', 'video'],
    // music / non-YouTube
    ['https://open.spotify.com/track/abc', 'music'],
    ['https://tidal.com/browse/track/123', 'music'],
    ['https://music.youtube.com/watch?v=abc', 'music'],
    // unknown
    ['https://example.com/foo', 'unknown'],
    ['not a url', 'unknown'],
    ['', 'unknown'],
  ]

  it.each(cases)('classifyURL(%s) → %s', (url, expected) => {
    expect(classifyURL(url)).toBe(expected)
  })
})
