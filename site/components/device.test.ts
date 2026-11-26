import { describe, expect, it } from 'vitest'
import { deviceOf } from './device'

const windows = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
const android = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36'

describe('deviceOf', () => {
  it('shows the phone on Android, whatever its battery', () => {
    expect(deviceOf({ userAgent: android, battery: { charging: false, level: 0.4 } })).toBe('phone')
  })
  it('shows a laptop when a battery runs down or is not full', () => {
    expect(deviceOf({ userAgent: windows, battery: { charging: false, level: 1 } })).toBe('laptop')
    expect(deviceOf({ userAgent: windows, battery: { charging: true, level: 0.6 } })).toBe('laptop')
  })
  it('shows the monitor by default: no battery, or one full on its charger', () => {
    expect(deviceOf({ userAgent: windows })).toBe('monitor')
    expect(deviceOf({ userAgent: windows, battery: { charging: true, level: 1 } })).toBe('monitor')
  })
})
