import { expect, it } from 'vitest'
import { fitSize } from './fitSize'

it('keeps the full size when it fits, shrinks only as much as needed, stops at the floor', () => {
  expect(fitSize(88, 28, () => true)).toBe(88)
  for (const widest of [87, 61, 29, 28]) expect(fitSize(88, 28, (size) => size <= widest)).toBe(widest)
  expect(fitSize(87.5, 28, (size) => size <= 60)).toBe(60)
  expect(fitSize(88, 28, () => false)).toBe(28)
  // Already under the floor (a tiny window): left as it is.
  expect(fitSize(20, 28, () => false)).toBe(20)
})
