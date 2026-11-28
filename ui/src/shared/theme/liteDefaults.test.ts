import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULTS, sanitize } from './theme'

// Legato Lite (shared/edition.ts).
vi.mock('../edition', () => ({ LITE: true }))

describe('Lite’s own defaults', () => {
  it('starts with animations off', () => {
    expect(DEFAULTS).toMatchObject({ motion: false, backdropMotion: false })
    expect(sanitize(null)).toMatchObject({ motion: false, backdropMotion: false })
  })

  // The folder on disk, as the shell caps it before the interface speaks (storage.rs).
  it('keeps half the covers on disk', () => {
    expect([DEFAULTS.coverCacheMb, sanitize(null).coverCacheMb]).toEqual([250, 250])
    expect(sanitize({ coverCacheMb: 1000 }).coverCacheMb).toBe(1000)
  })

  it('keeps what the user, or a synced full app, chose', () => {
    expect(sanitize({ motion: true, backdropMotion: true, defaultsVersion: 12 })).toMatchObject({ motion: true, backdropMotion: true })
  })

  it('draws the glass opaque, unblurred, while animations are off', () => {
    const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
    expect(css).toMatch(/:where\(\.still\) \.glass \{\n  background: color-mix\(in srgb, var\(--bg\) 92%, transparent\);\n  backdrop-filter: none;/)
  })
})
