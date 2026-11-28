/**
 * The user's own rearranging of the shell (plan-v2 "Rearrange the app"): each move on a placement, within `layout.ts`'
 * rules, and the placement written back as a theme's layout. A move the rules refuse returns the same placement. Pure.
 */
import { moveToSlot } from '../order'
import { arrangeParts, DEFAULT_LAYOUT, HIDEABLE, LAYOUT_API, PAGE_PARTS, PART_GROUPS, placesOf, pluginOf, REGIONS, type Layout, type Pages, type PartedPage, type PartedSurface, type PartsChoice, type Placement, type Region, type Surface } from './layout'

/** `surface` at slot `at` of `region` (a drop slot, the end by default). */
export function moveSurface(placement: Placement, surface: Surface, region: Region, at = placement.regions[region].length): Placement {
  if (!placesOf(surface).includes(region)) return placement
  const here = placement.regions[region]
  const regions = Object.fromEntries(REGIONS.map((side) => [side, placement.regions[side].filter((other) => other !== surface)])) as Placement['regions']
  regions[region] = here.includes(surface) ? moveToSlot(here, surface, at) : [...here.slice(0, at), surface, ...here.slice(at)]
  if (REGIONS.every((side) => regions[side].join() === placement.regions[side].join())) return placement
  return { ...placement, regions }
}

export type Direction = 'left' | 'right' | 'up' | 'down'

const OTHER_SIDE: Partial<Record<Direction | Region, Direction & Region>> = { left: 'right', right: 'left' }

/**
 * Right to left, the middle row is drawn mirrored: the layout's `left` is seen on the right. Turns a side as seen into
 * the layout's, and back.
 */
export function mirroredSide<Side extends Direction | Region>(side: Side, rightToLeft: boolean): Side {
  return (rightToLeft && (OTHER_SIDE[side] as Side | undefined)) || side
}

/**
 * One step by an arrow key: across the window, a column goes left or right (its side's other surfaces, then over the page
 * to the other side), a bar up or down. The same placement at the window's edge, or where the surface can't go.
 */
export function stepSurface(placement: Placement, surface: Surface, direction: Direction): Placement {
  const forward = direction === 'right' || direction === 'down'
  const [before, after]: [Region, Region] = direction === 'left' || direction === 'right' ? ['left', 'right'] : ['top', 'bottom']
  const region = REGIONS.find((side) => placement.regions[side].includes(surface))
  // From a bar's side to a column's (the logo): the outer end of that side.
  if (region !== before && region !== after) return moveSurface(placement, surface, forward ? after : before, forward ? undefined : 0)
  const here = placement.regions[region]
  const index = here.indexOf(surface)
  // `moveSurface`'s slot: before what sits there now, so one step later is two slots on.
  if (forward && index < here.length - 1) return moveSurface(placement, surface, region, index + 2)
  if (!forward && index > 0) return moveSurface(placement, surface, region, index - 1)
  // Past this side's end: over the page, to the near end of the other one.
  if (forward && region === before) return moveSurface(placement, surface, after, 0)
  if (!forward && region === after) return moveSurface(placement, surface, before)
  return placement
}

/** A choice as a placement keeps it: no empty list, nothing at all when both are. */
function trimmed({ order, hidden }: PartsChoice): PartsChoice | undefined {
  if (!order?.length && !hidden?.length) return undefined
  return { ...(order?.length && { order }), ...(hidden?.length && { hidden }) }
}

/** `record` with `value` under `key`; without the key when there is no value. */
function withEntry<Container extends object, Key extends keyof Container>(record: Container, key: Key, value: Container[Key] | undefined): Container {
  const copy = { ...record }
  if (value === undefined) delete copy[key]
  else copy[key] = value
  return copy
}

/** A bar's part at slot `at` of its own container (it never leaves it). */
export function moveInGroup(placement: Placement, surface: PartedSurface, part: string, at: number): Placement {
  const groups: readonly (readonly string[])[] = PART_GROUPS[surface]
  const choice = placement.parts[surface]
  // Every container's order as drawn, the hidden parts keeping their place.
  const drawn = groups.map((group) => arrangeParts<string>({ order: choice?.order }, group))
  const moved = drawn.map((group) => (group.includes(part) ? moveToSlot(group, part, Math.max(0, Math.min(group.length, at))) : group))
  if (moved.flat().join() === drawn.flat().join()) return placement
  const order = moved.flat().join() === groups.flat().join() ? undefined : moved.flat()
  return { ...placement, parts: withEntry(placement.parts, surface, trimmed({ order, hidden: choice?.hidden })) }
}

/** What an eye can hide: a surface, a bar's part, a page's part. */
export type HideTarget = { surface: Surface; part?: undefined } | { surface: PartedSurface; part: string } | { page: PartedPage; part: string }

const toggled = <Item>(list: Item[], item: Item) => (list.includes(item) ? list.filter((other) => other !== item) : [...list, item])

/** The logo and plugins' panels never hide; one of the sidebar and the top bar stays (a way around the app). */
function canHideSurface(hidden: Surface[], surface: Surface): boolean {
  if (surface === 'brand' || pluginOf(surface)) return false
  if (surface === 'sidebar') return !hidden.includes('topbar')
  if (surface === 'topbar') return !hidden.includes('sidebar')
  return true
}

/** Hides what shows, shows what is hidden. */
export function toggleHidden(placement: Placement, target: HideTarget): Placement {
  if ('page' in target) {
    const part = PAGE_PARTS[target.page].find((known) => known.id === target.part)
    if (!part || 'fixed' in part) return placement
    const choice = placement.pages[target.page]
    const next = trimmed({ order: choice?.order, hidden: toggled(choice?.hidden ?? [], target.part) })
    return { ...placement, pages: withEntry<Pages, PartedPage>(placement.pages, target.page, next) }
  }
  if (target.part !== undefined) {
    if (!HIDEABLE[target.surface].includes(target.part)) return placement
    const choice = placement.parts[target.surface]
    const next = trimmed({ order: choice?.order, hidden: toggled(choice?.hidden ?? [], target.part) })
    return { ...placement, parts: withEntry(placement.parts, target.surface, next) }
  }
  const { surface } = target
  if (!placement.hidden.includes(surface) && !canHideSurface(placement.hidden, surface)) return placement
  return { ...placement, hidden: toggled(placement.hidden, surface) }
}

/** The theme `layout` that draws this placement: only what differs from the app's own, undefined when nothing does.
 *  Format 1 (`LAYOUT_API`), so any version that reads layouts reads it. */
export function layoutFromPlacement({ regions, sizes, hidden, parts, pages }: Placement): Layout | undefined {
  // A region left as the app's own needs no name: its surfaces go to their default places.
  const moved = REGIONS.filter((region) => regions[region].length && regions[region].join() !== DEFAULT_LAYOUT.regions[region].join())
  const layout: Omit<Layout, 'v'> = {
    ...(moved.length && { regions: Object.fromEntries(moved.map((region) => [region, regions[region]])) }),
    ...(Object.keys(sizes).length && { sizes }),
    ...(hidden.length && { hidden }),
    ...(Object.keys(parts).length && { parts }),
    ...(Object.keys(pages).length && { pages }),
  }
  return Object.keys(layout).length ? { v: LAYOUT_API, ...layout } : undefined
}
