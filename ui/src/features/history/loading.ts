/** How the history page's answers come in. */
import type { Play } from '../../shared/api'

/** Tells whether an answer is still the one wanted: `ask()` before a request, its result says "no later one since". */
export function latestOnly() {
  let latest = 0
  return () => {
    const mine = ++latest
    return () => mine === latest
  }
}

/**
 * The plays shown, given the newest page asked again: that page, then the older ones already loaded. A page that isn't
 * full is the whole history (after a reset: nothing).
 */
export function withNewest(shown: Play[], newest: Play[], pageSize: number): Play[] {
  const last = newest.at(-1)
  if (!last || newest.length < pageSize) return newest
  return [...newest, ...shown.filter((play) => play.startedAt < last.startedAt)]
}
