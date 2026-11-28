import { describe, expect, it } from 'vitest'
import { artStep, canHideSurface, layoutFromPlacement, moveInGroup, moveSurface, neverHides, orderedParts, partAxis, partGroup, partStep, setHeader, setSize, stepPart, stepSurface, toggleHidden, type Direction, type HideTarget } from './arrange'
import { DEFAULT_LAYOUT, PAGE_PARTS, PART_GROUPS, REGIONS, resolveLayout, sanitizeLayout, SURFACES, type PartedPage, type PartedSurface, type Placement, type Region, type Surface } from './layout'

const start = DEFAULT_LAYOUT
const plugin: Surface = 'plugin:example.panel'

describe('moveSurface', () => {
  it.each<[Surface, Region]>([
    ['sidebar', 'right'],
    ['sidePanel', 'left'],
    ['playerBar', 'top'],
    ['brand', 'bottom'],
  ])('moves %s to %s', (surface, region) => {
    const moved = moveSurface(start, surface, region)
    expect(moved.regions[region].at(-1)).toBe(surface)
    expect(Object.values(moved.regions).flat().filter((other) => other === surface)).toHaveLength(1)
  })

  it.each<[Surface, Region]>([
    ['topbar', 'bottom'],
    ['sidebar', 'top'],
    ['playerBar', 'left'],
    [plugin, 'bottom'],
  ])('refuses %s at %s', (surface, region) => {
    expect(moveSurface(start, surface, region)).toBe(start)
  })

  it('takes a slot, within a region too, and says when nothing moved', () => {
    expect(moveSurface(start, 'sidebar', 'right', 0).regions.right).toEqual(['sidebar', 'sidePanel'])
    expect(moveSurface(start, 'playerBar', 'top', 1).regions.top).toEqual(['brand', 'playerBar', 'topbar'])
    expect(moveSurface(start, 'brand', 'top', 2).regions.top).toEqual(['topbar', 'brand'])
    expect(moveSurface(start, 'brand', 'top', 1)).toBe(start)
    expect(moveSurface(start, 'sidebar', 'left')).toBe(start)
  })
})

describe('stepSurface', () => {
  const steps = (surface: Surface, ...directions: Direction[]) => directions.reduce((placement, direction) => stepSurface(placement, surface, direction), start)
  const sides = ({ regions }: Placement) => [regions.left, regions.right]

  it('carries a column across the window, past its neighbours and over the page', () => {
    expect(sides(steps('sidebar', 'right'))).toEqual([[], ['sidebar', 'sidePanel']])
    expect(sides(steps('sidebar', 'right', 'right'))).toEqual([[], ['sidePanel', 'sidebar']])
    expect(sides(steps('sidebar', 'right', 'right', 'left'))).toEqual([[], ['sidebar', 'sidePanel']])
    expect(sides(steps('sidebar', 'right', 'left'))).toEqual([['sidebar'], ['sidePanel']])
    expect(sides(steps('sidePanel', 'left'))).toEqual([['sidebar', 'sidePanel'], []])
  })

  it('stops at the window’s edge and where the surface can’t go', () => {
    for (const [surface, direction] of [['sidebar', 'left'], ['sidePanel', 'right'], ['sidebar', 'up'], ['playerBar', 'left'], ['playerBar', 'down'], ['topbar', 'down'], ['topbar', 'left']] as [Surface, Direction][]) {
      expect(stepSurface(start, surface, direction), `${surface} ${direction}`).toBe(start)
    }
  })

  it('carries a bar over the page, then past its neighbours there', () => {
    const above = steps('playerBar', 'up')
    // Over the page: the near end of the top, under the top bar.
    expect([above.regions.top, above.regions.bottom]).toEqual([['brand', 'topbar', 'playerBar'], []])
    expect(steps('playerBar', 'up', 'up').regions.top).toEqual(['brand', 'playerBar', 'topbar'])
    expect(steps('playerBar', 'up', 'down')).toEqual(start)
  })

  it('takes the logo to any side', () => {
    expect(steps('brand', 'left').regions.left).toEqual(['brand', 'sidebar'])
    expect(steps('brand', 'right').regions.right).toEqual(['sidePanel', 'brand'])
    // Down: past the top bar first, then over the page.
    expect(steps('brand', 'down').regions.top).toEqual(['topbar', 'brand'])
    expect(steps('brand', 'down', 'down').regions.bottom).toEqual(['brand', 'playerBar'])
  })
})

describe('moveInGroup', () => {
  it('reorders a part inside its container only, and forgets an order back to the app’s own', () => {
    const moved = moveInGroup(start, 'playerBar', 'fullScreen', 0)
    expect(moved.parts.playerBar!.order).toEqual(['song', 'center', 'actions', 'transport', 'progress', 'fullScreen', 'room', 'sleep', 'lyrics', 'upNext', 'volume', 'more'])
    expect(moveInGroup(moved, 'playerBar', 'fullScreen', 99).parts).toEqual({})
  })

  it('keeps what is hidden and ignores a part it does not have', () => {
    const hidden = toggleHidden(start, { owner: 'topbar', part: 'addons' })
    expect(moveInGroup(hidden, 'topbar', 'addons', 0).parts.topbar).toEqual({ order: ['addons', 'history', 'search', 'offline'], hidden: ['addons'] })
    expect(moveInGroup(start, 'topbar', 'nothing', 0)).toBe(start)
  })
})

describe('toggleHidden', () => {
  it.each<HideTarget>([{ surface: 'sidebar' }, { surface: 'playerBar' }, { owner: 'topbar', part: 'history' }, { owner: 'album', part: 'more' }])('hides and shows %o', (target) => {
    const hidden = toggleHidden(start, target)
    expect(hidden).not.toEqual(start)
    expect(toggleHidden(hidden, target)).toEqual(start)
  })

  it.each<HideTarget>([{ surface: 'brand' }, { surface: plugin }, { owner: 'playerBar', part: 'song' }, { owner: 'topbar', part: 'search' }, { owner: 'album', part: 'tracks' }, { owner: 'songs', part: 'list' }, { owner: 'album', part: 'nothing' }, { owner: 'columns', part: 'album' }])('never hides %o', (target) => {
    expect(toggleHidden(start, target)).toBe(start)
  })

  it('tells a surface that never hides from one that can’t just now', () => {
    expect((['brand', plugin, 'sidebar', 'playerBar'] as Surface[]).map(neverHides)).toEqual([true, true, false, false])
    expect([canHideSurface([], 'sidebar'), canHideSurface(['topbar'], 'sidebar'), canHideSurface([], 'brand')]).toEqual([true, false, false])
  })

  it('never hides both the sidebar and the top bar', () => {
    const noSidebar = toggleHidden(start, { surface: 'sidebar' })
    expect(toggleHidden(noSidebar, { surface: 'topbar' })).toBe(noSidebar)
    const noTopbar = toggleHidden(start, { surface: 'topbar' })
    expect(toggleHidden(noTopbar, { surface: 'sidebar' })).toBe(noTopbar)
  })
})

describe('layoutFromPlacement', () => {
  it('writes only what differs, nothing for the app’s own', () => {
    expect(layoutFromPlacement(start)).toBeUndefined()
    expect(layoutFromPlacement(moveSurface(start, 'sidebar', 'right', 0))).toEqual({ v: 1, regions: { right: ['sidebar', 'sidePanel'] } })
  })

  it('reads back as the same placement after any two moves, from a layout an older version reads as is', () => {
    const surfaces: Surface[] = [...SURFACES, plugin]
    const base: Placement = resolveLayout({ v: 1, regions: { right: ['sidePanel', plugin] }, sizes: { sidebar: 300 }, pages: { header: { art: 'end' } } })
    const moves: ((placement: Placement) => Placement)[] = [
      ...surfaces.flatMap((surface) => REGIONS.flatMap((region) => [0, 1, 9].map((at) => (placement: Placement) => moveSurface(placement, surface, region, at)))),
      ...(Object.keys(PART_GROUPS) as PartedSurface[]).flatMap((surface) =>
        PART_GROUPS[surface].flat().flatMap((part) => [
          (placement: Placement) => moveInGroup(placement, surface, part, 0),
          (placement: Placement) => moveInGroup(placement, surface, part, 9),
          (placement: Placement) => toggleHidden(placement, { owner: surface, part }),
        ]),
      ),
      ...surfaces.map((surface) => (placement: Placement) => toggleHidden(placement, { surface })),
      ...(Object.keys(PAGE_PARTS) as PartedPage[]).flatMap((page) => PAGE_PARTS[page].map((part) => (placement: Placement) => toggleHidden(placement, { owner: page, part: part.id }))),
    ]
    let checked = 0
    for (const from of [start, base])
      for (const first of moves) {
        const once = first(from)
        for (const second of moves) {
          const placement = second(once)
          const layout = layoutFromPlacement(placement)
          // `toEqual` per pair is slow at this count: the strings are compared, the first difference shown whole.
          const same = JSON.stringify(resolveLayout(layout)) === JSON.stringify(placement) && (!layout || JSON.stringify(sanitizeLayout(layout)) === JSON.stringify(layout))
          if (!same) {
            expect(resolveLayout(layout), JSON.stringify(layout)).toEqual(placement)
            expect(sanitizeLayout(layout)).toEqual(layout)
          }
          checked++
        }
      }
    expect(checked).toBeGreaterThan(10_000)
  })
})

describe('a bar’s parts', () => {
  const shownOrder = (placement: Placement, surface: PartedSurface, part: string) => orderedParts(placement, surface, partGroup(surface, part))

  it('runs the player’s middle and the sidebar down, the others across', () => {
    expect([partAxis('playerBar', 'song'), partAxis('playerBar', 'progress'), partAxis('playerBar', 'volume'), partAxis('topbar', 'search'), partAxis('sidebar', 'nav')]).toEqual(['across', 'down', 'across', 'across', 'down'])
  })

  it('reads an arrow along the part’s container, mirrored right to left but in the player bar', () => {
    expect([partStep('topbar', 'search', 'left', false), partStep('topbar', 'search', 'right', false), partStep('topbar', 'search', 'up', false)]).toEqual([-1, 1, null])
    expect([partStep('topbar', 'search', 'left', true), partStep('playerBar', 'volume', 'left', true)]).toEqual([1, -1])
    expect([partStep('sidebar', 'library', 'up', true), partStep('sidebar', 'library', 'down', true), partStep('sidebar', 'library', 'left', true)]).toEqual([-1, 1, null])
  })

  it('steps past the next part on screen, a hidden or empty one counting for nothing', () => {
    // Hidden `lyrics`, nothing in `sleep`: one step right of `room` is past `upNext`.
    const hidden = toggleHidden(start, { owner: 'playerBar', part: 'lyrics' })
    const onScreen = ['room', 'upNext', 'volume']
    const moved = stepPart(hidden, 'playerBar', 'room', 1, onScreen)
    expect(shownOrder(moved, 'playerBar', 'room')).toEqual(['sleep', 'lyrics', 'upNext', 'room', 'volume', 'more', 'fullScreen'])
    expect(moved.parts.playerBar?.hidden).toEqual(['lyrics'])
    expect(shownOrder(stepPart(moved, 'playerBar', 'room', -1, onScreen), 'playerBar', 'room')).toEqual(['sleep', 'lyrics', 'room', 'upNext', 'volume', 'more', 'fullScreen'])
  })

  it('stays at its container’s end', () => {
    expect(stepPart(start, 'sidebar', 'nav', -1, ['nav', 'library'])).toBe(start)
    expect(stepPart(start, 'sidebar', 'library', 1, ['nav', 'library'])).toBe(start)
    expect(stepPart(start, 'playerBar', 'transport', 1, ['transport'])).toBe(start)
  })
})

describe('a page’s parts and the lists’ columns', () => {
  const sameAgain = (placement: Placement) => resolveLayout(sanitizeLayout(JSON.parse(JSON.stringify(layoutFromPlacement(placement)))) ?? undefined)

  it('moves a page’s block, the fixed ones too, and writes it where the layout format keeps it', () => {
    const moved = stepPart(start, 'artist', 'topSongs', -1, ['mostPlayed', 'topSongs', 'about'])
    expect(moved.pages.artist?.order).toEqual(['topSongs', 'mostPlayed', 'discography', 'about', 'links', 'shelves'])
    expect(sameAgain(moved).pages).toEqual(moved.pages)
    // Back as the app's own: nothing left to say.
    expect(stepPart(moved, 'artist', 'topSongs', 1, ['mostPlayed', 'topSongs']).pages).toEqual({})
  })

  it('moves a column among those shown, and never moves or hides Time', () => {
    const moved = stepPart(start, 'columns', 'genre', -1, ['album', 'genre'])
    expect(moved.pages.lists?.columns?.slice(0, 3)).toEqual(['genre', 'album', 'year'])
    expect(sameAgain(moved).pages.lists).toEqual(moved.pages.lists)
    expect(moveInGroup(start, 'columns', 'duration', 0)).toBe(start)
    expect(toggleHidden(start, { owner: 'columns', part: 'album' })).toBe(start)
  })

  it('reads the arrows as each container runs', () => {
    expect([partAxis('artist', 'about'), partAxis('columns', 'album'), partAxis('nowPlayingColumns', 'cover'), partAxis('nowPlaying', 'title'), partAxis('nowPlayingControls', 'volume')]).toEqual(['down', 'across', 'across', 'down', 'across'])
    expect([partStep('columns', 'album', 'left', true), partStep('nowPlaying', 'title', 'up', true)]).toEqual([1, -1])
  })
})

describe('the page headers’ choice', () => {
  it('keeps what differs from the app’s own, and writes it into the layout', () => {
    const end = setHeader(start, { art: 'end' })
    expect(end.pages.header).toEqual({ art: 'end' })
    const quiet = setHeader(end, { kicker: false, actions: 'beside' })
    expect(quiet.pages.header).toEqual({ art: 'end', kicker: false, actions: 'beside' })
    expect(layoutFromPlacement(quiet)?.pages?.header).toEqual(quiet.pages.header)
    expect(setHeader(quiet, { art: 'start', kicker: true, actions: undefined }).pages).toEqual({})
  })

  it('says when nothing changed, and keeps the rest of the pages', () => {
    expect(setHeader(start, { art: 'start' })).toBe(start)
    const moved = stepPart(start, 'home', 'sections', -1, ['chips', 'sections'])
    expect(setHeader(moved, { sub: false }).pages).toEqual({ home: moved.pages.home, header: { sub: false } })
  })

  it('sends the art where the arrow points, as seen', () => {
    expect([artStep('left', false), artStep('right', false), artStep('up', false), artStep('down', false)]).toEqual(['start', 'end', 'top', 'start'])
    expect([artStep('left', true), artStep('right', true)]).toEqual(['end', 'start'])
  })
})

describe('a column’s width', () => {
  it('is kept within its bounds, and written into the layout', () => {
    const wide = setSize(start, 'sidebar', 999)
    expect([wide.sizes.sidebar, setSize(start, 'sidePanel', 10.4).sizes.sidePanel, setSize(start, 'sidebar', 300.6).sizes.sidebar]).toEqual([420, 260, 301])
    expect(layoutFromPlacement(wide)?.sizes).toEqual({ sidebar: 420 })
  })

  it('goes back to the app’s own without one, and says when nothing changed', () => {
    const wide = setSize(start, 'sidebar', 300)
    expect(setSize(wide, 'sidebar', 300)).toBe(wide)
    expect(setSize(start, 'sidebar', undefined)).toBe(start)
    expect(layoutFromPlacement(setSize(wide, 'sidebar', undefined))).toBeUndefined()
  })
})
