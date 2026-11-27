import { create } from 'zustand'
import { readStored, writeStored } from '../../shared/stored'

const KEY = 'legato.eqByDevice'
/** Devices remembered at most. */
const KEEP = 50

/** The equalizer preset (its English name) picked for each output device (its name; the system's default is `default`), this PC's. */
function load(): Record<string, string> {
  const raw = readStored<object>(KEY, {}, (value) => !!value && typeof value === 'object' && !Array.isArray(value))
  return Object.fromEntries(Object.entries(raw).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1].length < 40).slice(-KEEP))
}

export const useDeviceEq = create<{ map: Record<string, string> }>(() => ({ map: load() }))

/** Picks `preset` for a device (null: none). */
export function setDeviceEq(device: string | null, preset: string | null) {
  const key = device ?? 'default'
  const rest = Object.fromEntries(Object.entries(useDeviceEq.getState().map).filter(([k]) => k !== key))
  const map = preset && preset !== 'Flat' ? { ...rest, [key]: preset } : rest
  useDeviceEq.setState({ map: Object.fromEntries(Object.entries(map).slice(-KEEP)) })
  writeStored(KEY, useDeviceEq.getState().map)
}
