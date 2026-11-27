import { expect, it } from 'vitest'
import { moveToSlot } from './order'

it('puts an item before what sits at the slot, going down or up, or at the end', () => {
  // 1 dropped before 4 (slot 4): lands right before it.
  expect(moveToSlot([0, 1, 2, 3, 4], 1, 4)).toEqual([0, 2, 3, 1, 4])
  // Upward: before 1.
  expect(moveToSlot([0, 1, 2, 3, 4], 3, 1)).toEqual([0, 3, 1, 2, 4])
  expect(moveToSlot([0, 1, 2], 0, 3)).toEqual([1, 2, 0])
})

it('leaves a list without the item as it is', () => {
  const list = [0, 1, 2]
  expect(moveToSlot(list, 9, 1)).toBe(list)
})
