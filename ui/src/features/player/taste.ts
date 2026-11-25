import { create } from 'zustand'
import { api, type LibraryTrack, type TasteSignal } from '../../shared/api'
import { onListenEnd, REPLAY_GAP, session, SKIP_MS } from './listens'
import { usePickWhy } from './pickWhyStore'
import type { Taste } from './score'

/**
 * The taste signals of the library (decayed plays, last played, recent skips, liked, less, never), read once from Rust and kept in memory
 * (docs/recommendation.md): Shuffle and what plays after Up next read this cache, never wait on it. A song not in it has no signal. Loaded
 * when the app is idle and again every `RELOAD_EVERY` listens; a failed load keeps the previous one.
 */
export const RELOAD_EVERY = 20

interface TasteState {
  signals: Map<number, TasteSignal>
  loaded: boolean
}

export const useTaste = create<TasteState>(() => ({ signals: new Map(), loaded: false }))

export async function loadTaste(ask: () => Promise<TasteSignal[]> = api.tasteSignals): Promise<void> {
  try {
    useTaste.setState({ signals: new Map((await ask()).map((s) => [s.id, s])), loaded: true })
  } catch {
    // Offline from Rust never happens; a failed read leaves what we had.
  }
}

/**
 * This session's explore picks ("new" in Up next) heard to the end or skipped early, memory only: the explore slots learn from them
 * (`score.ts` `K.bandit`). shortcut: a catalog song has no listen (store.ts), so only library songs count; fine while most explore
 * picks are the library's.
 */
const explored = { hits: 0, misses: 0 }

/** Loads now and after every `RELOAD_EVERY`-th listen; counts the explore picks' outcomes. Returns the way out. */
export function startTaste(ask: () => Promise<TasteSignal[]> = api.tasteSignals): () => void {
  void loadTaste(ask)
  let n = 0
  return onListenEnd((play) => {
    if (usePickWhy.getState()[play.trackId]?.kind === 'new') {
      if (play.completed) explored.hits++
      else if (play.listenedMs < SKIP_MS) explored.misses++
    }
    if (++n % RELOAD_EVERY === 0) void loadTaste(ask)
  })
}

/**
 * Replayed this session, before the next reload counts it: heard twice here within a day, or heard here within a day after the
 * last play the signals knew (a later reload sees this listen itself: its own start, not before it).
 * shortcut: the signals' last play may be a skip, which Rust would not count; fine until it shows in picks.
 */
function replayedNow(id: number, lastPlayed: number): boolean {
  const at = session.heard.get(id)
  return session.replays.has(id) || (at !== undefined && lastPlayed > 0 && lastPlayed < at && at - lastPlayed <= REPLAY_GAP)
}

/** What the model reads about a song: the store's stats (`stats[id]` = listens, last start, rating) and the signals. */
export function tasteFor(stats: Record<number, [plays: number, last: number, stars?: number] | undefined>, signals: Map<number, TasteSignal>): Taste {
  return {
    rating: (t: LibraryTrack) => stats[t.id]?.[2] ?? 0,
    plays: (t: LibraryTrack) => stats[t.id]?.[0] ?? 0,
    // This session's early skips count at once; the store counts them too once it reloads.
    skips: (t: LibraryTrack) => Math.max(signals.get(t.id)?.skipsRecent ?? 0, session.skips.get(t.id) ?? 0),
    heard: (t: LibraryTrack) => session.last.get(t.id) ?? 0,
    near: (t: LibraryTrack) => signals.get(t.id)?.near ?? [],
    never: (t: LibraryTrack) => signals.get(t.id)?.never ?? false,
    less: (t: LibraryTrack) => signals.get(t.id)?.less ?? false,
    // A song heard again within a day is a strong like, beside Liked Music (Rust counts the replays from the stored plays).
    liked: (t: LibraryTrack) => (signals.get(t.id)?.liked ?? false) || (signals.get(t.id)?.replays ?? 0) > 0 || replayedNow(t.id, signals.get(t.id)?.lastPlayed ?? 0),
    // The long profile mixes the two memories as the design says: 70 % the last weeks (30-day half-life), 30 % the months (180).
    decayed: (t: LibraryTrack) => {
      const s = signals.get(t.id)
      return s ? 0.7 * s.playsDecayed + 0.3 * s.playsLong : 0
    },
    hours: (t: LibraryTrack) => signals.get(t.id)?.hours ?? 0,
    // The stats see a start at once, the signals at their next load.
    lastPlayed: (t: LibraryTrack) => Math.max(signals.get(t.id)?.lastPlayed ?? 0, stats[t.id]?.[1] ?? 0),
    explored: { ...explored },
  }
}
