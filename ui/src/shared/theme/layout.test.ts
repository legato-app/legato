import { describe, expect, it } from 'vitest'
import { arrangeParts, DEFAULT_LAYOUT, headerLayout, PAGE_PARTS, pagePartIds, PART_GROUPS, layoutOn, layoutRegions, layoutSummary, resolveLayout, sanitizeLayout, withoutLayout, type Layout } from './layout'

const resolve = (raw: unknown) => resolveLayout(sanitizeLayout(raw) ?? undefined)
const draw = (raw: unknown, playerOpen = false) => layoutRegions(resolve(raw), playerOpen)

describe('layoutRegions', () => {
  it('draws the app’s own arrangement in today’s order, with no reordering', () => {
    expect(layoutRegions(DEFAULT_LAYOUT)).toEqual({ regions: { top: ['topbar'], left: ['sidebar'], right: ['sidePanel'], bottom: ['playerBar'] }, brandInTopbar: true, topbarBare: false, playerBarHidden: false })
  })

  it('draws the logo once, whatever the file says, Now Playing open or not', () => {
    const hostile = [
      { v: 1, hidden: ['brand', 'topbar', 'sidebar', 'sidePanel', 'playerBar'] },
      { v: 1, regions: { top: ['topbar', 'brand'] }, hidden: ['topbar'] },
      { v: 1, regions: { left: ['brand'] }, hidden: ['sidebar', 'brand'] },
      { v: 1, regions: { right: ['brand', 'sidebar'] } },
      { v: 1, regions: { bottom: ['brand'], top: ['playerBar', 'topbar'] } },
      { v: 9, hidden: ['brand'] },
    ]
    for (const raw of hostile) {
      for (const playerOpen of [false, true]) {
        const { regions, brandInTopbar } = draw(raw, playerOpen)
        const alone = Object.values(regions).flat().filter((surface) => surface === 'brand').length
        expect(alone + Number(brandInTopbar), JSON.stringify(raw)).toBe(1)
        // The top bar is always drawn, bare or not: the logo in it shows.
        expect(regions.top).toContain('topbar')
      }
    }
  })

  it('stands the logo alone away from the top bar, back in it while Now Playing is up', () => {
    expect(draw({ v: 1, regions: { left: ['brand'] } })).toMatchObject({ brandInTopbar: false, regions: { left: ['sidebar', 'brand'] } })
    expect(draw({ v: 1, regions: { top: ['topbar', 'brand'] } })).toMatchObject({ brandInTopbar: false, regions: { top: ['topbar', 'brand'] } })
    expect(draw({ v: 1, regions: { left: ['brand'] } }, true)).toMatchObject({ brandInTopbar: true, regions: { left: ['sidebar'] } })
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

describe('a bar’s parts', () => {
  const actions = PART_GROUPS.playerBar[2]

  it('keeps known parts per bar, each once, and hides only what stays reachable', () => {
    const got = sanitizeLayout({ v: 1, parts: { playerBar: { order: ['volume', 'volume', 'search', 'song'], hidden: ['sleep', 'more', 'song', 'progress'] }, topbar: { hidden: ['search', 'addons'] }, sidebar: { hidden: ['library'] }, sidePanel: { hidden: ['x'] } } })
    expect(got?.parts).toEqual({ playerBar: { order: ['volume', 'song'], hidden: ['sleep'] }, topbar: { hidden: ['addons'] } })
    expect(sanitizeLayout({ v: 1, parts: { topbar: { order: [], hidden: ['logo'] } } })).toBeNull()
  })

  it('draws the app’s order without a choice, the unnamed at their default place', () => {
    for (const groups of Object.values(PART_GROUPS)) for (const group of groups) expect(arrangeParts<string>(undefined, group)).toEqual(group)
    expect(arrangeParts({ order: ['volume', 'room'] }, actions)).toEqual(['volume', 'more', 'fullScreen', 'room', 'sleep', 'lyrics', 'upNext'])
    expect(arrangeParts({ order: ['progress'], hidden: ['transport', 'sleep'] }, PART_GROUPS.playerBar[1])).toEqual(['progress'])
    expect(arrangeParts({ order: ['library', 'nav'] }, PART_GROUPS.sidebar[0])).toEqual(['library', 'nav'])
  })

  it('is said in the warning, only when something moves', () => {
    const summary = (parts: unknown) => layoutSummary(sanitizeLayout({ v: 1, parts }) ?? undefined)
    expect(summary({ topbar: { hidden: ['addons'] } })).toEqual(['Parts of the bars moved or hidden'])
    expect(summary({ topbar: { order: ['history', 'search'] } })).toEqual([])
  })
})

describe('headerLayout', () => {
  it('keeps what differs from the page’s own, the size clamped, unknown values dropped', () => {
    expect(headerLayout({ art: 'end', artSize: 900, kicker: false, sub: false, actions: 'beside', color: 'red' })).toEqual({ art: 'end', artSize: 320, kicker: false, sub: false, actions: 'beside' })
    expect(headerLayout({ artSize: 3 })).toEqual({ artSize: 120 })
    for (const raw of [undefined, 'top', {}, { art: 'start', kicker: true, sub: 'no' }, { art: 'left', artSize: '200', actions: 'above' }]) expect(headerLayout(raw), JSON.stringify(raw)).toBeUndefined()
  })

  it('travels in the layout, said in the warning, ignored on a phone', () => {
    const layout = sanitizeLayout({ v: 1, pages: { header: { art: 'none' }, home: {} } })!
    expect(layout.pages).toEqual({ header: { art: 'none' } })
    expect(layoutSummary(layout)).toEqual(['Page headers arranged another way'])
    expect(resolveLayout(layout).pages.header).toEqual({ art: 'none' })
    expect(resolveLayout(layout, true).pages).toEqual({})
  })
})

describe('a page’s parts', () => {
  it('keeps known parts, never hides a fixed one, new ones at their default place', () => {
    const got = sanitizeLayout({ v: 1, pages: { album: { order: ['more', 'credits'], hidden: ['tracks', 'more'] }, artist: { hidden: ['mostPlayed', 'topSongs', 'links', 'about'] }, home: { hidden: ['more'] } } })!
    expect(got.pages).toEqual({ album: { order: ['more'], hidden: ['more'] }, artist: { hidden: ['about'] } })
    expect(arrangeParts({ order: ['shelves', 'mostPlayed'] }, pagePartIds('artist'))).toEqual(['shelves', 'mostPlayed', 'topSongs', 'discography', 'about', 'links'])
    for (const page of ['album', 'artist'] as const) expect(arrangeParts(undefined, pagePartIds(page))).toEqual(PAGE_PARTS[page].map((part) => part.id))
  })

  it('says which pages change', () => {
    const summary = (pages: unknown) => layoutSummary(sanitizeLayout({ v: 1, pages }) ?? undefined)
    expect(summary({ album: { order: ['more', 'tracks'] }, artist: { hidden: ['shelves'] } })).toEqual(['Album pages arranged their own way', 'Artist pages arranged their own way'])
    expect(summary({ album: { order: ['tracks'] } })).toEqual([])
  })
})

describe('layoutSummary', () => {
  const summary = (raw: unknown) => layoutSummary(sanitizeLayout(raw) ?? undefined)

  it('says nothing for a layout that changes nothing here', () => {
    expect(layoutSummary(undefined)).toEqual([])
    expect(summary({ v: 1, regions: { top: ['brand', 'topbar'], left: ['sidebar'] }, hidden: ['brand'] })).toEqual([])
    expect(summary({ v: 2, hidden: ['sidebar'] })).toEqual([])
  })

  it('says each difference on its own line', () => {
    expect(summary({ v: 1, regions: { right: ['sidebar'] } })).toEqual(['The sidebar on the right'])
    expect(summary({ v: 1, regions: { left: ['sidePanel'], top: ['playerBar'], bottom: ['brand'] } })).toEqual(['The side panel on the left', 'The player bar at the top', 'The logo at the bottom'])
    expect(summary({ v: 1, hidden: ['topbar', 'sidePanel', 'playerBar'] })).toEqual(['A smaller top bar', 'No side panel', 'No player bar'])
    expect(summary({ v: 1, sizes: { sidebar: 300, sidePanel: 360 } })).toEqual(['The sidebar 300 px wide', 'The side panel 360 px wide'])
    expect(summary({ v: 1, regions: { top: ['topbar', 'brand'] } })).toEqual(['The logo elsewhere at the top'])
  })

  it('stops at six lines', () => {
    const lines = summary({ v: 1, regions: { right: ['sidebar'], left: ['sidePanel', 'brand'], top: ['topbar', 'playerBar'] }, sizes: { sidebar: 300, sidePanel: 360 }, hidden: ['topbar'] })
    expect(lines).toHaveLength(7)
    expect(lines.at(-1)).toBe('And more')
  })

  it('says a layout is on only when themes may and it changes something', () => {
    expect(layoutOn(true, { v: 1, hidden: ['sidebar'] })).toBe(true)
    expect(layoutOn(false, { v: 1, hidden: ['sidebar'] })).toBe(false)
    expect(layoutOn(true, undefined)).toBe(false)
    expect(layoutOn(true, { v: 1, regions: { left: ['sidebar'] } })).toBe(false)
  })

  it('takes a layout off a theme, nothing else', () => {
    const theme: { name: string; layout?: Layout } = { name: 'Night', layout: { v: 1, hidden: ['sidebar'] } }
    expect(withoutLayout(theme)).toEqual({ name: 'Night' })
    expect(theme.layout).toBeDefined()
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
