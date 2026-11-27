import { describe, expect, it } from 'vitest'
import { DEFAULTS, MAX_CUSTOM_THEMES, PRESETS, sanitize, sanitizeTheme, undoAddedTheme, withAddedTheme, type Settings, type Theme } from './theme'

// A theme as the doors make one: a preset's colors under a new id, with what the test adds.
const theme = (name: string, patch: Partial<Theme> = {}) => sanitizeTheme({ ...PRESETS[0], ...patch, name, id: undefined })!
const settings = (patch: Partial<Settings> = {}): Settings => ({ ...DEFAULTS, ...patch })

describe('withAddedTheme', () => {
  it('adds the theme, picks it and applies its look', () => {
    const joining = theme('Night', { look: { covers: 'vinyl', density: 'compact' } })
    const joined = withAddedTheme(settings(), joining)!
    expect(joined.added).toBe(true)
    expect(joined.changes).toMatchObject({ theme: joining.id, covers: 'vinyl', density: 'compact', customThemes: [joining] })
    // What sanitize keeps is what was written.
    expect(sanitize({ ...settings(), ...joined.changes }).theme).toBe(joining.id)
  })

  it('leaves the look alone for a copy of what is on screen', () => {
    const joined = withAddedTheme(settings(), theme('Copy', { look: { covers: 'vinyl' } }), { look: false })!
    expect(joined.changes).not.toHaveProperty('covers')
    expect(joined.changes.theme).toBe(joined.theme.id)
  })

  it('picks the same theme already there and adds nothing, but a different one of the same name joins', () => {
    const own = theme('Night', { css: '.kicker { letter-spacing: 0.2em; }' })
    const again = withAddedTheme(settings({ customThemes: [own] }), theme('Night', { css: '.kicker { letter-spacing: 0.2em; }' }))!
    expect(again.added).toBe(false)
    expect(again.changes).toEqual({ theme: own.id })
    const other = withAddedTheme(settings({ customThemes: [own] }), theme('Night', { css: '.kicker { letter-spacing: 0.4em; }' }))!
    expect(other.added).toBe(true)
    expect(other.changes.customThemes).toHaveLength(2)
  })

  it('refuses one past the cap, never losing one at sanitize, and still picks one already there', () => {
    const full = Array.from({ length: MAX_CUSTOM_THEMES }, (_, index) => theme(`Theme ${index}`))
    expect(withAddedTheme(settings({ customThemes: full }), theme('One more'))).toBeNull()
    expect(withAddedTheme(settings({ customThemes: full }), theme('Theme 3'))!.added).toBe(false)
    const room = withAddedTheme(settings({ customThemes: full.slice(1) }), theme('Last one'))!
    expect(sanitize({ ...settings(), ...room.changes }).customThemes).toHaveLength(MAX_CUSTOM_THEMES)
  })

  it('is undone: the theme out, the pick and the look back, themes that arrived since kept', () => {
    const before = settings({ theme: 'paper', covers: 'rounded' })
    const joined = withAddedTheme(before, theme('Night', { look: { covers: 'vinyl' } }))!
    const synced = theme('From the other PC')
    const undone = undoAddedTheme({ customThemes: [joined.theme, synced] }, before, joined)
    expect(undone).toEqual({ theme: 'paper', covers: 'rounded', customThemes: [synced] })
    // A theme that was already there stays.
    const own = theme('Night')
    const again = withAddedTheme(settings({ theme: 'paper', customThemes: [own] }), theme('Night'))!
    expect(undoAddedTheme({ customThemes: [own] }, settings({ theme: 'paper', customThemes: [own] }), again)).toEqual({ theme: 'paper' })
  })
})
