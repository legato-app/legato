import { describe, expect, it } from 'vitest'
import { canHideSurface, layoutFromPlacement, moveInGroup, moveSurface, neverHides, stepSurface, toggleHidden, type Direction, type HideTarget } from './arrange'
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
    const hidden = toggleHidden(start, { surface: 'topbar', part: 'addons' })
    expect(moveInGroup(hidden, 'topbar', 'addons', 0).parts.topbar).toEqual({ order: ['addons', 'history', 'search', 'offline'], hidden: ['addons'] })
    expect(moveInGroup(start, 'topbar', 'nothing', 0)).toBe(start)
  })
})

describe('toggleHidden', () => {
  it.each<HideTarget>([{ surface: 'sidebar' }, { surface: 'playerBar' }, { surface: 'topbar', part: 'history' }, { page: 'album', part: 'more' }])('hides and shows %o', (target) => {
    const hidden = toggleHidden(start, target)
    expect(hidden).not.toEqual(start)
    expect(toggleHidden(hidden, target)).toEqual(start)
  })

  it.each<HideTarget>([{ surface: 'brand' }, { surface: plugin }, { surface: 'playerBar', part: 'song' }, { surface: 'topbar', part: 'search' }, { page: 'album', part: 'tracks' }, { page: 'songs', part: 'list' }, { page: 'album', part: 'nothing' }])('never hides %o', (target) => {
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
          (placement: Placement) => toggleHidden(placement, { surface, part }),
        ]),
      ),
      ...surfaces.map((surface) => (placement: Placement) => toggleHidden(placement, { surface })),
      ...(Object.keys(PAGE_PARTS) as PartedPage[]).flatMap((page) => PAGE_PARTS[page].map((part) => (placement: Placement) => toggleHidden(placement, { page, part: part.id }))),
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
