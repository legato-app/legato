/** A speed kept per book (the Audiobooks page): the Live Editor's tempo, pitch kept, applied when the book starts if it has no edit of its own. */
import { isObject, readStored, writeStored } from '../../shared/stored'
export const STEPS = [1, 1.25, 1.5, 2] as const
const KEY = 'legato.bookSpeed'
const MAX = 200

export type Speeds = Record<string, number>

export const loadSpeeds = () => readStored<Speeds>(KEY, {}, isObject)

/** The map with this book's speed set; normal speed takes it out. Oldest go past MAX (insertion order). */
export function withSpeed(m: Speeds, key: string, v: number): Speeds {
  const out = { ...m }
  delete out[key]
  if (STEPS.includes(v as (typeof STEPS)[number]) && v !== 1) out[key] = v
  const keys = Object.keys(out)
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX))) delete out[k]
  return out
}

export const saveSpeeds = (speeds: Speeds) => writeStored(KEY, speeds)

/** This song's kept speed (a song key as `songKey` writes it), 1 when none. */
export const speedFor = (key: string | null): number => {
  const v = key ? loadSpeeds()[key] : undefined
  return typeof v === 'number' && v >= 1 && v <= 2 ? v : 1
}
