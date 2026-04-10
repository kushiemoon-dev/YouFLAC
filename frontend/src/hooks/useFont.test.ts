import { describe, it, expect, beforeEach } from 'vitest'
import { applyFont } from './useFont'

describe('applyFont', () => {
  beforeEach(() => {
    document.documentElement.style.removeProperty('--font-family-sans')
  })

  it('sets --font-family-sans for known font', () => {
    applyFont('inter')
    expect(document.documentElement.style.getPropertyValue('--font-family-sans'))
      .toContain('Inter')
  })

  it('falls back to outfit for unknown font', () => {
    applyFont('unknown')
    expect(document.documentElement.style.getPropertyValue('--font-family-sans'))
      .toContain('Outfit')
  })
})
