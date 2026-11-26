/** A point on the page, in px. */
export type Point = [number, number]

/**
 * The CSS matrix3d that lays a `width`×`height` box (transform-origin 0 0) on any four corners: top left, top right,
 * bottom right, bottom left. A projective map, so a screen seen at an angle keeps its perspective.
 */
export function homography(width: number, height: number, [[x0, y0], [x1, y1], [x2, y2], [x3, y3]]: Point[]): string {
  // The unit square onto the four corners (Heckbert's closed form), then scaled to the box.
  const [dx1, dx2, dx3] = [x1 - x2, x3 - x2, x0 - x1 + x2 - x3]
  const [dy1, dy2, dy3] = [y1 - y2, y3 - y2, y0 - y1 + y2 - y3]
  const det = dx1 * dy2 - dx2 * dy1
  const g = det ? (dx3 * dy2 - dx2 * dy3) / det : 0
  const h = det ? (dx1 * dy3 - dx3 * dy1) / det : 0
  const [a, b, c] = [x1 - x0 + g * x1, x3 - x0 + h * x3, x0]
  const [d, e, f] = [y1 - y0 + g * y1, y3 - y0 + h * y3, y0]
  const m = [a / width, d / width, 0, g / width, b / height, e / height, 0, h / height, 0, 0, 1, 0, c, f, 0, 1]
  return `matrix3d(${m.join(',')})`
}
