/** The moves made while arranging, to undo and redo. Pure. */
import type { Placement } from '../../shared/theme/layout'

/** Moves kept at most. */
export const HISTORY_LIMIT = 50

export interface History {
  past: Placement[]
  present: Placement
  future: Placement[]
}

export const historyFrom = (present: Placement): History => ({ past: [], present, future: [] })

/** A move: what could be redone goes. A refused one (the same placement, `arrange.ts`) changes nothing. */
export function moved(history: History, next: Placement): History {
  if (next === history.present) return history
  return { past: [...history.past, history.present].slice(-HISTORY_LIMIT), present: next, future: [] }
}

export function undone(history: History): History {
  const previous = history.past.at(-1)
  return previous ? { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] } : history
}

export function redone(history: History): History {
  const [next, ...future] = history.future
  return next ? { past: [...history.past, history.present], present: next, future } : history
}
