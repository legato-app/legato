import { expect, it } from 'vitest'
import { moveInGroup, moveSurface } from '../../shared/theme/arrange'
import { DEFAULT_LAYOUT } from '../../shared/theme/layout'
import { artZones, boxAround, boxWithin, dropZones, EDGE, partZones } from './zones'

const view = { width: 1000, height: 600 }
const box = (left: number, width: number) => ({ left, top: 50, width, height: 450 })
const boxes = { sidebar: box(0, 200), sidePanel: box(700, 300), playerBar: { left: 0, top: 520, width: 1000, height: 80 }, topbar: { left: 0, top: 0, width: 1000, height: 50 } }

it('offers a column both sides’ edges and either half of the columns there, never itself', () => {
  const zones = dropZones(DEFAULT_LAYOUT, 'sidebar', boxes, view)
  expect(zones.map((zone) => [zone.region, zone.at])).toEqual([['left', 0], ['right', 1], ['right', 0], ['right', 1]])
  expect(zones[1].box).toEqual({ left: view.width - EDGE, top: 0, width: EDGE, height: view.height })
  expect(zones.slice(2).map((zone) => zone.box)).toEqual([box(700, 150), box(850, 150)])
  // Each zone's slot does what it shows: before the side panel, or after it.
  expect(moveSurface(DEFAULT_LAYOUT, 'sidebar', zones[2].region, zones[2].at).regions.right).toEqual(['sidebar', 'sidePanel'])
  expect(moveSurface(DEFAULT_LAYOUT, 'sidebar', zones[3].region, zones[3].at).regions.right).toEqual(['sidePanel', 'sidebar'])
  expect(new Set(zones.map((zone) => zone.key)).size).toBe(zones.length)
})

it('offers a bar the top and the bottom, halved over and under what is there', () => {
  const zones = dropZones(DEFAULT_LAYOUT, 'playerBar', boxes, view)
  expect(zones.map((zone) => [zone.region, zone.at])).toEqual([['top', 0], ['bottom', 1], ['top', 1], ['top', 2]])
  expect(zones.slice(2).map((zone) => [zone.box.top, zone.box.height])).toEqual([[0, 25], [25, 25]])
})

it('mirrors the zones right to left, where the layout’s left is seen on the right', () => {
  // As drawn right to left: the sidebar (layout left) on the right, the side panel on the left.
  const seen = { sidebar: box(800, 200), sidePanel: box(0, 300) }
  const zones = dropZones(DEFAULT_LAYOUT, 'sidebar', seen, view, true)
  expect(zones.map((zone) => [zone.region, zone.at, zone.box.left])).toEqual([
    ['left', 0, view.width - EDGE],
    ['right', 1, 0],
    // Before the side panel: its half nearer the page, the right one here.
    ['right', 0, 150],
    ['right', 1, 0],
  ])
})

it('offers nothing a surface can’t take, and no halves of what isn’t drawn', () => {
  expect(dropZones(DEFAULT_LAYOUT, 'sidePanel', {}, view).map((zone) => zone.key)).toEqual(['arrange:left', 'arrange:right'])
  expect(dropZones(DEFAULT_LAYOUT, 'topbar', {}, view).map((zone) => zone.region)).toEqual(['top'])
})

it('offers a part either half of the others of its container, side by side or one above the other', () => {
  const order = ['song', 'center', 'actions']
  const drawn: Record<string, ReturnType<typeof box>> = { song: box(0, 300), center: box(300, 400), actions: box(700, 300) }
  const across = partZones(order, 'center', (part) => drawn[part], 'across')
  expect(across.map((zone) => [zone.at, zone.box.left, zone.box.width])).toEqual([[0, 0, 150], [1, 150, 150], [2, 700, 150], [3, 850, 150]])
  // Each zone's slot does what it shows: dropped after the buttons, it comes last.
  expect(moveInGroup(DEFAULT_LAYOUT, 'playerBar', 'center', across[3].at).parts.playerBar?.order?.slice(0, 3)).toEqual(['song', 'actions', 'center'])
  expect(partZones(['nav', 'library'], 'nav', () => box(0, 200), 'down').map((zone) => [zone.at, zone.box.top, zone.box.height])).toEqual([[1, 50, 225], [2, 275, 225]])
  // Right to left, the half on the left comes after.
  expect(partZones(order, 'center', (part) => drawn[part], 'across', true).slice(0, 2).map((zone) => [zone.at, zone.box.left])).toEqual([[0, 150], [1, 0]])
  expect(new Set(across.map((zone) => zone.key)).size).toBe(across.length)
})

it('offers nothing beside a part that isn’t on screen', () => {
  expect(partZones(['nav', 'library'], 'nav', () => undefined, 'down')).toEqual([])
})

it('draws one box around a part drawn in several pieces', () => {
  expect(boxAround([{ left: 10, top: 20, width: 30, height: 10 }, { left: 50, top: 15, width: 10, height: 30 }])).toEqual({ left: 10, top: 15, width: 50, height: 30 })
  expect(boxAround([])).toBeNull()
})

it('keeps what of a box shows inside its page', () => {
  const page = { left: 0, top: 100, width: 500, height: 300 }
  expect(boxWithin({ left: 20, top: 50, width: 100, height: 100 }, page)).toEqual({ left: 20, top: 100, width: 100, height: 50 })
  expect(boxWithin({ left: 20, top: 400, width: 100, height: 100 }, page)).toBeNull()
})

it('offers a header’s art a place above, before and after its title, as seen', () => {
  const header = { left: 100, top: 0, width: 600, height: 300 }
  expect(artZones(header).map((zone) => [zone.place, zone.box.left, zone.box.top])).toEqual([['top', 100, 0], ['start', 100, 100], ['end', 400, 100]])
  expect(artZones(header, true).map((zone) => [zone.place, zone.box.left])).toEqual([['top', 100], ['start', 400], ['end', 100]])
})
