/**
 * Where what is dragged can be dropped. A surface: each side of the window it may go to, and either half of the
 * surfaces already there (before or after them). A bar's part: either half of the others in its container. Pure.
 */
import { placesOf, type Placement, type Region, type Surface } from '../../shared/theme/layout'

export interface Box {
  left: number
  top: number
  width: number
  height: number
}

export interface Zone {
  /** Its drop target id (`data-drop`). */
  key: string
  region: Region
  /** The slot in the region's list, as `moveSurface` reads it. */
  at: number
  box: Box
}

/** How far into the window a side's own zone reaches. */
export const EDGE = 64

function edgeBox(region: Region, view: View): Box {
  if (region === 'left') return { left: 0, top: 0, width: EDGE, height: view.height }
  if (region === 'right') return { left: view.width - EDGE, top: 0, width: EDGE, height: view.height }
  if (region === 'top') return { left: 0, top: 0, width: view.width, height: EDGE }
  return { left: 0, top: view.height - EDGE, width: view.width, height: EDGE }
}

/** The one box around all of `boxes`; null without any. */
export function boxAround(boxes: readonly Box[]): Box | null {
  if (!boxes.length) return null
  const left = Math.min(...boxes.map((box) => box.left))
  const top = Math.min(...boxes.map((box) => box.top))
  return { left, top, width: Math.max(...boxes.map((box) => box.left + box.width)) - left, height: Math.max(...boxes.map((box) => box.top + box.height)) - top }
}

/** `box` split in two: side by side (`across`), or one above the other. */
function halves(across: boolean, box: Box): [Box, Box] {
  if (across) {
    const width = box.width / 2
    return [{ ...box, width }, { ...box, left: box.left + width, width }]
  }
  const height = box.height / 2
  return [{ ...box, height }, { ...box, top: box.top + height, height }]
}

interface View {
  width: number
  height: number
}

/** Seen in a mirror: as far from the window's right edge as `box` is from its left one. */
const mirroredBox = (box: Box, view: View): Box => ({ ...box, left: view.width - box.left - box.width })

/**
 * The zones as seen. Right to left the window is the left-to-right one in a mirror: worked out there, from the boxes
 * mirrored, then mirrored back.
 */
export function dropZones(placement: Placement, surface: Surface, boxes: Partial<Record<Surface, Box>>, view: View, rightToLeft = false): Zone[] {
  if (!rightToLeft) return leftToRightZones(placement, surface, boxes, view)
  const mirrored = Object.fromEntries(Object.entries(boxes).map(([name, box]) => [name, mirroredBox(box!, view)]))
  return leftToRightZones(placement, surface, mirrored, view).map((zone) => ({ ...zone, box: mirroredBox(zone.box, view) }))
}

/** The sides' zones first, the surfaces' halves over them (drawn later, so they win where both are). */
function leftToRightZones(placement: Placement, surface: Surface, boxes: Partial<Record<Surface, Box>>, view: View): Zone[] {
  const regions = placesOf(surface)
  // The window's outer edge: first on the left and at the top, last on the right and at the bottom.
  const edges = regions.map((region) => ({ key: `arrange:${region}`, region, at: region === 'left' || region === 'top' ? 0 : placement.regions[region].length, box: edgeBox(region, view) }))
  const beside = regions.flatMap((region) =>
    placement.regions[region].flatMap((other, index) => {
      const box = other === surface ? undefined : boxes[other]
      if (!box) return []
      // Columns split left and right, bars top and bottom.
      return halves(region === 'left' || region === 'right', box).map((half, side) => ({ key: `arrange:${other}:${side}`, region, at: index + side, box: half }))
    }),
  )
  return [...edges, ...beside]
}

export interface PartZone {
  /** Its drop target id (`data-drop`). */
  key: string
  /** The slot in the container's list, as `moveInGroup` reads it. */
  at: number
  box: Box
}

/**
 * The zones for a dragged part: before and after each other part of its container that is on screen. `order`: the
 * container's, hidden parts included; `mirrored`: drawn right to left, so the half on the left comes after.
 */
export function partZones(order: readonly string[], dragged: string, boxOf: (part: string) => Box | undefined, axis: 'across' | 'down', mirrored = false): PartZone[] {
  return order.flatMap((other, index) => {
    const box = other === dragged ? undefined : boxOf(other)
    if (!box) return []
    const [first, second] = halves(axis === 'across', box)
    const inOrder = mirrored && axis === 'across' ? [second, first] : [first, second]
    return inOrder.map((half, side) => ({ key: `arrange:part:${other}:${side}`, at: index + side, box: half }))
  })
}
