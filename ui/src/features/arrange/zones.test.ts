import { expect, it } from 'vitest'
import { moveSurface } from '../../shared/theme/arrange'
import { DEFAULT_LAYOUT } from '../../shared/theme/layout'
import { dropZones, EDGE } from './zones'

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
