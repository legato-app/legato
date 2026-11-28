import { describe, expect, it } from 'vitest'
import { moveSurface, toggleHidden } from './arrange'
import { DEFAULT_LAYOUT, resolveLayout } from './layout'
import { saveArrangement } from './saveArrangement'
import { MAX_CUSTOM_THEMES, PRESETS, sanitize, sanitizeTheme, type Settings, type Theme } from './theme'

const preset = PRESETS[0]
const moved = moveSurface(DEFAULT_LAYOUT, 'sidebar', 'right')
const own = (id: string, patch: Partial<Theme> = {}) => sanitizeTheme({ ...preset, id, name: id, ...patch })!
const settingsWith = (themes: Theme[], theme: string, patch: Partial<Settings> = {}): Settings => ({ ...sanitize({}), customThemes: themes, theme, ...patch })

describe('saving an arrangement made by hand', () => {
  it('writes nothing when nothing moved', () => {
    expect(saveArrangement(settingsWith([], preset.id), preset, DEFAULT_LAYOUT, 'Copy')).toEqual({ kind: 'unchanged' })
    const theme = own('custom-a', { layout: { v: 1, regions: { right: ['sidebar', 'sidePanel'] } } })
    expect(saveArrangement(settingsWith([theme], theme.id), theme, resolveLayout(theme.layout), 'Copy')).toEqual({ kind: 'unchanged' })
  })

  it('rewrites the user’s own theme, turns arrangements back on, and undoes', () => {
    const edited = own('custom-a')
    const other = own('custom-b')
    const before = settingsWith([edited, other], edited.id, { themeLayouts: false })
    const saved = saveArrangement(before, edited, moved, 'Copy')
    if (saved.kind !== 'saved') throw new Error(saved.kind)
    expect(saved.changes.themeLayouts).toBe(true)
    expect(saved.changes.theme).toBeUndefined()
    expect(saved.changes.customThemes?.map((theme) => theme.id)).toEqual([edited.id, other.id])
    expect(resolveLayout(saved.theme.layout).regions.right).toContain('sidebar')
    // Undo, the list having grown meanwhile (Sync Mode): this theme as it was, the rest as it is.
    const later = own('custom-c')
    const now = { ...before, ...saved.changes, customThemes: [...saved.changes.customThemes!, later] }
    expect(saved.undo(now)).toEqual({ customThemes: [edited, other, later], themeLayouts: false })
  })

  it('drops the layout of a theme put back to the app’s own', () => {
    const edited = own('custom-a', { layout: { v: 1, hidden: ['sidePanel'] } })
    const saved = saveArrangement(settingsWith([edited], edited.id), edited, DEFAULT_LAYOUT, 'Copy')
    expect(saved.kind === 'saved' && 'layout' in saved.theme).toBe(false)
  })

  it('copies a preset under the given name, picked, its look left alone, and undoes the copy', () => {
    const before = settingsWith([], preset.id, { density: 'airy' })
    const saved = saveArrangement(before, preset, toggleHidden(DEFAULT_LAYOUT, { surface: 'sidePanel' }), 'Paper custom')
    if (saved.kind !== 'saved') throw new Error(saved.kind)
    expect(saved.theme).toMatchObject({ name: 'Paper custom', layout: { v: 1, hidden: ['sidePanel'] } })
    expect(saved.theme.id).not.toBe(preset.id)
    expect(saved.changes).toEqual({ theme: saved.theme.id, customThemes: [saved.theme], themeLayouts: true })
    expect(saved.undo({ ...before, ...saved.changes })).toMatchObject({ theme: preset.id, customThemes: [] })
  })

  it('keeps a layout a newer app wrote: the moves go into a copy', () => {
    const newer = own('custom-a', { layout: { v: 99 } })
    const saved = saveArrangement(settingsWith([newer], newer.id), newer, moved, 'custom-a custom')
    if (saved.kind !== 'saved') throw new Error(saved.kind)
    expect(saved.changes.customThemes).toEqual([newer, saved.theme])
    expect(saved.theme.layout?.v).toBe(1)
  })

  it('says a full list when a copy has nowhere to go', () => {
    const themes = Array.from({ length: MAX_CUSTOM_THEMES }, (_, index) => own(`custom-${index}`))
    expect(saveArrangement(settingsWith(themes, preset.id), preset, moved, 'Copy')).toEqual({ kind: 'full' })
    // The user's own theme still saves.
    expect(saveArrangement(settingsWith(themes, 'custom-0'), themes[0], moved, 'Copy').kind).toBe('saved')
  })
})
