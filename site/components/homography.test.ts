import { describe, expect, it } from 'vitest'
import { homography, type Point } from './homography'

/** Where matrix3d puts a point of the box (column-major, as CSS reads it). */
function apply(matrix: string, [x, y]: Point): Point {
  const m = matrix.slice(9, -1).split(',').map(Number)
  const w = m[3] * x + m[7] * y + m[15]
  return [(m[0] * x + m[4] * y + m[12]) / w, (m[1] * x + m[5] * y + m[13]) / w]
}

describe('a box laid on four corners', () => {
  it('lands each corner of the box on its point, at an angle too', () => {
    const corners: Point[] = [[120, 40], [610, 70], [580, 400], [90, 350]]
    const matrix = homography(1360, 860, corners)
    const box: Point[] = [[0, 0], [1360, 0], [1360, 860], [0, 860]]
    box.forEach((point, n) => {
      const [x, y] = apply(matrix, point)
      expect(x).toBeCloseTo(corners[n][0], 6)
      expect(y).toBeCloseTo(corners[n][1], 6)
    })
  })
  it('a straight rectangle is only a scale and a move', () => {
    expect(homography(100, 50, [[10, 20], [210, 20], [210, 120], [10, 120]])).toBe('matrix3d(2,0,0,0,0,2,0,0,0,0,1,0,10,20,0,1)')
  })
})
