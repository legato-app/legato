import { expect, it, vi } from 'vitest'
import { NEUTRAL, withDeviceEq } from './effects'

it('keeps each output’s preset across a restart; an output never set keeps the song’s own equalizer', async () => {
  const kept = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => kept.get(key) ?? null, setItem: (key: string, value: string) => void kept.set(key, value) })
  const { setDeviceEq } = await import('./deviceEq')
  setDeviceEq('Headphones', 'Bass')
  // The system's default output, then a device set back to Flat: forgotten.
  setDeviceEq(null, 'Bass')
  setDeviceEq('Speakers', 'Bass')
  setDeviceEq('Speakers', 'Flat')
  vi.resetModules()
  const { useDeviceEq } = await import('./deviceEq')
  expect(useDeviceEq.getState().map).toEqual({ Headphones: 'Bass', default: 'Bass' })
  const own = { ...NEUTRAL, eq: [3, 0, 0, 0, 0, 0, 0, 0, 0, 0] }
  expect(withDeviceEq(own, useDeviceEq.getState().map['Never seen'])).toBe(own)
  vi.unstubAllGlobals()
})
