import { describe, expect, it } from 'vitest'
import { extrasFor } from './screenExtras'

describe('what the phone screen off turns off in the live analysis', () => {
  const all = { coverPulse: true, viz: true, meter: true }
  it('screen on: everything asked stays asked', () => {
    expect(extrasFor(true, all)).toEqual(all)
    expect(extrasFor(true, { coverPulse: false, viz: true, meter: false })).toEqual({ coverPulse: false, viz: true, meter: false })
  })
  it('screen off: the visualizer, the moving cover and the meter are not analysed', () => {
    expect(extrasFor(false, all)).toEqual({ coverPulse: false, viz: false, meter: false })
  })
})
