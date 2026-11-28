/**
 * Where a dragged surface can be dropped: each side of the window it may go to, and either half of the surfaces already
 * there (before or after them). Pure.
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

function edgeBox(region: Region, view: { width: number; height: number }): Box {
  if (region === 'left') return { left: 0, top: 0, width: EDGE, height: view.height }
  if (region === 'right') return { left: view.width - EDGE, top: 0, width: EDGE, height: view.height }
  if (region === 'top') return { left: 0, top: 0, width: view.width, height: EDGE }
  return { left: 0, top: view.height - EDGE, width: view.width, height: EDGE }
}

/** Columns split left and right, bars top and bottom. */
function halves(region: Region, box: Box): [Box, Box] {
  if (region === 'left' || region === 'right') {
    const width = box.width / 2
    return [{ ...box, width }, { ...box, left: box.left + width, width }]
  }
  const height = box.height / 2
  return [{ ...box, height }, { ...box, top: box.top + height, height }]
}

/** The sides' zones first, the surfaces' halves over them (drawn later, so they win where both are). */
export function dropZones(placement: Placement, surface: Surface, boxes: Partial<Record<Surface, Box>>, view: { width: number; height: number }): Zone[] {
  const regions = placesOf(surface)
  // The window's outer edge: first on the left and at the top, last on the right and at the bottom.
  const edges = regions.map((region) => ({ key: `arrange:${region}`, region, at: region === 'left' || region === 'top' ? 0 : placement.regions[region].length, box: edgeBox(region, view) }))
  const beside = regions.flatMap((region) =>
    placement.regions[region].flatMap((other, index) => {
      const box = other === surface ? undefined : boxes[other]
      if (!box) return []
      return halves(region, box).map((half, side) => ({ key: `arrange:${other}:${side}`, region, at: index + side, box: half }))
    }),
  )
  return [...edges, ...beside]
}
