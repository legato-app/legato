import { describe, expect, it } from 'vitest'
import { DEFAULT_LAYOUT, layoutRegions, resolveLayout, sanitizeLayout } from './layout'

const resolve = (raw: unknown) => resolveLayout(sanitizeLayout(raw) ?? undefined)
const draw = (raw: unknown, playerOpen = false) => layoutRegions(resolve(raw), playerOpen)

describe('layoutRegions', () => {
  it('draws the app’s own arrangement in today’s order, with no reordering', () => {
    expect(layoutRegions(DEFAULT_LAYOUT)).toEqual({ regions: { top: ['topbar'], left: ['sidebar'], right: ['sidePanel'], bottom: ['playerBar'] }, topbarBare: false, playerBarHidden: false })
  })

  it('leaves out hidden columns, keeps the player bar mounted and a bare top bar', () => {
    const got = draw({ v: 1, hidden: ['sidePanel', 'playerBar', 'topbar'] })
    expect(got.regions).toEqual({ top: ['topbar'], left: ['sidebar'], right: [], bottom: ['playerBar'] })
    expect(got).toMatchObject({ topbarBare: true, playerBarHidden: true })
    expect(draw({ v: 1, hidden: ['sidebar'] }).regions.left).toEqual([])
    expect(draw({ v: 1, hidden: ['topbar'] }, true).topbarBare).toBe(false)
  })

  it('orders the blocks only when the player bar shows elsewhere than last', () => {
    expect(draw({ v: 1, regions: { top: ['topbar', 'playerBar'] } }).order).toEqual({ topbar: 0, playerBar: 1, main: 2 })
    expect(draw({ v: 1, regions: { top: ['playerBar'] } }).order).toEqual({ topbar: 0, playerBar: 1, main: 2 })
    expect(draw({ v: 1, regions: { right: ['sidebar'] } }).order).toBeUndefined()
    expect(draw({ v: 1, regions: { top: ['playerBar'] }, hidden: ['playerBar'] }).order).toBeUndefined()
  })
})

describe('sanitizeLayout', () => {
  it('keeps what is valid, drops unknown keys and ids', () => {
    const got = sanitizeLayout({ v: 1, regions: { left: ['sidePanel', 'lyricsWall', 7], middle: ['sidebar'], right: 'sidebar' }, hidden: ['sidePanel', 'main'], script: 'alert(1)' })
    expect(got).toEqual({ v: 1, regions: { left: ['sidePanel'] }, hidden: ['sidePanel'] })
  })

  it('keeps a surface in its first place only, and only where it fits', () => {
    const got = sanitizeLayout({ v: 1, regions: { top: ['sidebar', 'playerBar', 'playerBar'], left: ['topbar', 'sidebar'], right: ['sidebar'], bottom: ['playerBar', 'topbar'] } })
    expect(got?.regions).toEqual({ top: ['playerBar'], left: ['sidebar'] })
  })

  it('clamps sizes', () => {
    expect(sanitizeLayout({ v: 1, sizes: { sidebar: 5000, sidePanel: 1.4, topbar: 300 } })?.sizes).toEqual({ sidebar: 420, sidePanel: 260 })
    expect(sanitizeLayout({ v: 1, sizes: { sidebar: '300', sidePanel: NaN } })).toBeNull()
  })

  it('is null without a version or anything valid', () => {
    for (const raw of [undefined, 'x', [], {}, { v: 0 }, { v: 1.5 }, { v: '1' }, { v: 1 }, { v: 1, regions: { top: [] }, hidden: ['nothing'] }, { regions: { right: ['sidebar'] } }]) {
      expect(sanitizeLayout(raw), JSON.stringify(raw)).toBeNull()
    }
  })

  it('keeps a newer app’s layout as it came, bounded, and never applies it', () => {
    const newer = { v: 2, regions: { right: ['sidebar'] }, somethingNew: [1] }
    expect(sanitizeLayout(newer)).toEqual(newer)
    expect(resolve(newer)).toBe(DEFAULT_LAYOUT)
    expect(sanitizeLayout({ v: 3, blob: 'x'.repeat(9000) })).toEqual({ v: 3 })
  })
})

describe('resolveLayout', () => {
  it('is today’s arrangement without a layout, and on a phone', () => {
    expect(resolveLayout(undefined)).toBe(DEFAULT_LAYOUT)
    expect(resolveLayout({ v: 1, hidden: ['sidePanel'] }, true)).toBe(DEFAULT_LAYOUT)
    expect(DEFAULT_LAYOUT.regions).toEqual({ top: ['brand', 'topbar'], left: ['sidebar'], right: ['sidePanel'], bottom: ['playerBar'] })
    expect(resolve({ v: 1, sizes: { sidebar: 300 } }).regions).toEqual(DEFAULT_LAYOUT.regions)
  })

  it('moves what is named, the rest at its default place', () => {
    expect(resolve({ v: 1, regions: { right: ['sidebar'], left: ['sidePanel'] } }).regions).toEqual({ top: ['brand', 'topbar'], left: ['sidePanel'], right: ['sidebar'], bottom: ['playerBar'] })
    expect(resolve({ v: 1, regions: { top: ['playerBar'] } }).regions).toEqual({ top: ['brand', 'topbar', 'playerBar'], left: ['sidebar'], right: ['sidePanel'], bottom: [] })
    expect(resolve({ v: 1, regions: { right: ['sidebar'] } }).regions.right).toEqual(['sidePanel', 'sidebar'])
    expect(resolve({ v: 1, regions: { left: ['sidePanel'] } }).regions).toMatchObject({ left: ['sidebar', 'sidePanel'], right: [] })
  })

  it('keeps an unnamed logo with the top bar, a named one where it is put', () => {
    expect(resolve({ v: 1, regions: { top: ['playerBar', 'topbar'] } }).regions.top).toEqual(['playerBar', 'brand', 'topbar'])
    expect(resolve({ v: 1, regions: { bottom: ['brand'] } }).regions).toMatchObject({ top: ['topbar'], bottom: ['playerBar', 'brand'] })
  })

  it('never hides the logo, nor both the sidebar and the top bar', () => {
    expect(resolve({ v: 1, hidden: ['brand', 'sidePanel', 'playerBar'] }).hidden).toEqual(['sidePanel', 'playerBar'])
    expect(resolve({ v: 1, hidden: ['topbar'] }).hidden).toEqual(['topbar'])
    expect(resolve({ v: 1, hidden: ['topbar', 'sidebar'] }).hidden).toEqual(['sidebar'])
  })

  it('draws every surface exactly once, whatever the file says', () => {
    const hostile = [{ v: 1, hidden: ['brand', 'topbar', 'sidebar', 'sidePanel', 'playerBar'] }, { v: 1, regions: { top: ['brand', 'brand'], bottom: ['brand', 'topbar'] } }, { v: 1, regions: { left: ['topbar', 'playerBar'] }, hidden: ['brand'] }]
    for (const raw of hostile) {
      const { regions, hidden } = resolve(raw)
      expect(Object.values(regions).flat().sort(), JSON.stringify(raw)).toEqual(['brand', 'playerBar', 'sidePanel', 'sidebar', 'topbar'])
      expect(hidden).not.toContain('brand')
    }
  })
})
