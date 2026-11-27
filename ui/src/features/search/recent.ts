import { create } from 'zustand'
import { fold } from '../../shared/format'
import { readStored, removeStored, writeStored } from '../../shared/stored'

/** Recent searches of the top bar: this PC only (localStorage; settings travel with Sync Mode, these don't). */
const KEY = 'recentSearches'
export const MAX_RECENT = 8

/** q on top, once (case and accents ignored), the oldest dropped past the max. */
export function remember(list: string[], q: string): string[] {
  const text = q.trim()
  if (!text) return list
  return [text, ...list.filter((x) => fold(x) !== fold(text))].slice(0, MAX_RECENT)
}

const load = () => readStored<unknown[]>(KEY, [], Array.isArray).filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENT)

export const useRecent = create<{ list: string[] }>(() => ({ list: load() }))

function save(list: string[]) {
  useRecent.setState({ list })
  if (list.length) writeStored(KEY, list)
  else removeStored(KEY)
}

export const addRecent = (q: string) => save(remember(useRecent.getState().list, q))
export const forgetRecent = (q: string) => save(useRecent.getState().list.filter((x) => x !== q))
export const clearRecent = () => save([])
