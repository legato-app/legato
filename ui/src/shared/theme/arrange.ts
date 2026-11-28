/**
 * The user's own rearranging of the shell (plan-v2 "Rearrange the app"): each move on a placement, within `layout.ts`'
 * rules, and the placement written back as a theme's layout. A move the rules refuse returns the same placement. Pure.
 */
import { moveToSlot } from '../order'
import { arrangeParts, DEFAULT_LAYOUT, fitSize, headerLayout, HIDEABLE, LAYOUT_API, MOVABLE_COLUMNS, PAGE_PARTS, pagePartIds, PART_GROUPS, placesOf, pluginOf, REGIONS, type HeaderChoice, type Layout, type Pages, type PartedPage, type PartedSurface, type PartsChoice, type Placement, type Region, type SizedSurface, type Surface } from './layout'

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

/** What holds parts that move among themselves: a bar, a page, the songs lists' columns. */
export type PartOwner = PartedSurface | PartedPage | 'columns'

const isBar = (owner: PartOwner): owner is PartedSurface => owner in PART_GROUPS

/** An owner's containers, each a list of parts in the app's order: a part never leaves its own. */
function containers(owner: PartOwner): readonly (readonly string[])[] {
  if (isBar(owner)) return PART_GROUPS[owner]
  return [owner === 'columns' ? MOVABLE_COLUMNS : pagePartIds(owner)]
}

/** The parts sharing `part`'s container, in the app's order. */
export const partGroup = (owner: PartOwner, part: string): readonly string[] => containers(owner).find((group) => group.includes(part)) ?? []

/** The order and the hidden parts a placement keeps for an owner. */
function choiceOf({ parts, pages }: Placement, owner: PartOwner): PartsChoice | undefined {
  if (isBar(owner)) return parts[owner]
  return owner === 'columns' ? { order: pages.lists?.columns } : pages[owner]
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

/** The placement with an owner's choice, written where the layout format keeps it. */
function withChoice(placement: Placement, owner: PartOwner, choice: PartsChoice): Placement {
  const kept = trimmed(choice)
  if (isBar(owner)) return { ...placement, parts: withEntry(placement.parts, owner, kept) }
  if (owner === 'columns') return { ...placement, pages: withEntry<Pages, 'lists'>(placement.pages, 'lists', kept?.order && { columns: kept.order }) }
  return { ...placement, pages: withEntry<Pages, PartedPage>(placement.pages, owner, kept) }
}

export const hiddenParts = (placement: Placement, owner: PartOwner): readonly string[] => choiceOf(placement, owner)?.hidden ?? []

/** A container's parts as the placement orders them, the hidden ones keeping their place. */
export const orderedParts = (placement: Placement, owner: PartOwner, group: readonly string[]) => arrangeParts<string>({ order: choiceOf(placement, owner)?.order }, group)

/** Each of an owner's containers, its parts as the placement orders them. */
export const orderedContainers = (placement: Placement, owner: PartOwner) => containers(owner).map((group) => orderedParts(placement, owner, group))

/** Whether a part's container is drawn as a column or runs across: the columns: the player's middle, the sidebar, the
 *  pages' blocks and Now Playing's title block. */
export function partAxis(owner: PartOwner, part: string): 'across' | 'down' {
  if (owner === 'playerBar') return (PART_GROUPS.playerBar[1] as readonly string[]).includes(part) ? 'down' : 'across'
  return owner === 'topbar' || owner === 'columns' || owner === 'nowPlayingColumns' || owner === 'nowPlayingControls' ? 'across' : 'down'
}

/** Whether an owner's parts are drawn mirrored right to left: the player bar reads left to right in every language. */
export const mirrorsParts = (owner: PartOwner) => owner !== 'playerBar'

/** The step an arrow key makes in a part's container, one earlier or later; null for an arrow across the container. */
export function partStep(owner: PartOwner, part: string, direction: Direction, rightToLeft: boolean): -1 | 1 | null {
  const down = partAxis(owner, part) === 'down'
  const seen = down ? direction : mirroredSide(direction, rightToLeft && mirrorsParts(owner))
  if (seen === (down ? 'up' : 'left')) return -1
  return seen === (down ? 'down' : 'right') ? 1 : null
}

/** A part that is itself a container of others, drawn over most of it. */
export const holdsParts = (owner: PartOwner, part: string) => owner === 'playerBar' && (part === 'center' || part === 'actions')

/**
 * One step in the part's container, past the next of the parts `filled` (a hidden one, or one with nothing to show,
 * counts for nothing). The same placement at the container's end.
 */
export function stepPart(placement: Placement, owner: PartOwner, part: string, step: -1 | 1, filled: readonly string[]): Placement {
  const order = orderedParts(placement, owner, partGroup(owner, part))
  const seen = order.filter((other) => other === part || filled.includes(other))
  const neighbor = seen[seen.indexOf(part) + step]
  if (neighbor === undefined) return placement
  // `moveInGroup`'s slot: before what sits there now, so after the neighbor is one further.
  return moveInGroup(placement, owner, part, order.indexOf(neighbor) + (step > 0 ? 1 : 0))
}

/** The columns always hide by the user's own pick, never by a layout. */
export function canHidePart(owner: PartOwner, part: string): boolean {
  if (isBar(owner)) return HIDEABLE[owner].includes(part)
  return owner !== 'columns' && PAGE_PARTS[owner].some((known) => known.id === part && !('fixed' in known))
}

/** A part at slot `at` of its own container. */
export function moveInGroup(placement: Placement, owner: PartOwner, part: string, at: number): Placement {
  const groups = containers(owner)
  // Every container's order as drawn.
  const drawn = groups.map((group) => orderedParts(placement, owner, group))
  const moved = drawn.map((group) => (group.includes(part) ? moveToSlot(group, part, Math.max(0, Math.min(group.length, at))) : group))
  if (moved.flat().join() === drawn.flat().join()) return placement
  const order = moved.flat().join() === groups.flat().join() ? undefined : moved.flat()
  return withChoice(placement, owner, { order, hidden: choiceOf(placement, owner)?.hidden })
}

/** What an eye can hide: a surface, or a part of a bar or a page. */
export type HideTarget = { surface: Surface; part?: undefined } | { owner: PartOwner; part: string }

const toggled = <Item>(list: readonly Item[], item: Item) => (list.includes(item) ? list.filter((other) => other !== item) : [...list, item])

/** The logo and plugins' panels never hide: no eye, no key for them. */
export const neverHides = (surface: Surface) => surface === 'brand' || pluginOf(surface) !== undefined

/** Whether `surface` can be hidden now: one of the sidebar and the top bar stays (a way around the app). */
export function canHideSurface(hidden: Surface[], surface: Surface): boolean {
  if (neverHides(surface)) return false
  if (surface === 'sidebar') return !hidden.includes('topbar')
  if (surface === 'topbar') return !hidden.includes('sidebar')
  return true
}

/** Hides what shows, shows what is hidden. */
export function toggleHidden(placement: Placement, target: HideTarget): Placement {
  if (target.part !== undefined) {
    const { owner, part } = target
    if (!canHidePart(owner, part)) return placement
    return withChoice(placement, owner, { order: choiceOf(placement, owner)?.order, hidden: toggled(hiddenParts(placement, owner), part) })
  }
  const { surface } = target
  if (!placement.hidden.includes(surface) && !canHideSurface(placement.hidden, surface)) return placement
  return { ...placement, hidden: toggled(placement.hidden, surface) }
}

/** A column's width, within its bounds; undefined gives back the app's own (the user's setting, for the sidebar). */
export function setSize(placement: Placement, surface: SizedSurface, width: number | undefined): Placement {
  const size = width === undefined ? undefined : fitSize(surface, width)
  if (placement.sizes[surface] === size) return placement
  return { ...placement, sizes: withEntry(placement.sizes, surface, size) }
}

/** Where a page header's art goes. */
export type ArtPlace = NonNullable<HeaderChoice['art']>

/** The page headers' choice with `change`: what is the app's own is left out of it. */
export function setHeader(placement: Placement, change: Partial<HeaderChoice>): Placement {
  const header = headerLayout({ ...placement.pages.header, ...change })
  if (JSON.stringify(header) === JSON.stringify(placement.pages.header)) return placement
  return { ...placement, pages: withEntry<Pages, 'header'>(placement.pages, 'header', header) }
}

/** Where an arrow key sends the art: before the title, after it (as seen: mirrored right to left), above, back down. */
export function artStep(direction: Direction, rightToLeft: boolean): ArtPlace {
  if (direction === 'up') return 'top'
  return mirroredSide(direction, rightToLeft) === 'right' ? 'end' : 'start'
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
