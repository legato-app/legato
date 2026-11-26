/** The largest whole size from `floor` to `max` at which `fits` holds (it holds below any size it holds at); `floor` when none does. */
export function fitSize(max: number, floor: number, fits: (size: number) => boolean): number {
  if (max <= floor || fits(max)) return max
  let low = floor
  let high = Math.ceil(max)
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2)
    if (fits(middle)) low = middle
    else high = middle
  }
  return low
}
