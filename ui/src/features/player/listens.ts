import { api, type Play } from '../../shared/api'
import { usePickWhy } from './pickWhyStore'

/** Current listen, reported once when it ends (feeds mixes). */
interface Listen {
  trackId: number
  /** Unix seconds. */
  startedAt: number
  /** Forward progress only: seeking ahead doesn't count as listening. */
  heardMs: number
  lastMs: number
  durationMs: number | null
  /** A catalog song (a radio's, a search's): its verdict counts for this session only, it has no stored play. */
  remote?: boolean
}

let cur: Listen | null = null

/** Natural end = completed; else complete past 90 %. Under 2 s = accidental click, not recorded. */
export function toPlay(l: Listen, ended: boolean): Play | null {
  const completed = ended || (!!l.durationMs && l.lastMs >= 0.9 * l.durationMs)
  if (!completed && l.heardMs < 2000) return null
  return { trackId: l.trackId, startedAt: l.startedAt, listenedMs: Math.round(l.heardMs), completed }
}

/** Others want finished listens too (Last.fm, ListenBrainz), with the song's length. Returns the way out. */
type Listener = (play: Play, durationMs: number | null) => void
const listeners = new Set<Listener>()
export const onListenEnd = (f: Listener) => {
  listeners.add(f)
  return () => void listeners.delete(f)
}

/** Under this, not finished: an early skip (Rust's `mixes::SKIP_MS`). */
export const SKIP_MS = 30_000

/** Heard again this soon (s) after the last listen heard: a replay (Rust's `history::REPLAY_GAP`). */
export const REPLAY_GAP = 86_400

/**
 * This session's verdicts, in memory only (docs/recommendation.md › In the session): early skips counted by song, the last
 * verdict by song (-1 skipped early, 1 heard to the end), the start of the last listen heard (finished or 30 s, unix s) and the
 * songs replayed, the explore picks ("new") heard to the end (hits) or skipped early (misses). Catalog songs too, by their
 * session id (`remoteTrack`). Shuffle and what plays next react to them at once.
 */
export const session = { skips: new Map<number, number>(), last: new Map<number, -1 | 1>(), heard: new Map<number, number>(), replays: new Set<number>(), explored: { hits: 0, misses: 0 } }

export function endListen(ended: boolean) {
  const play = cur && toPlay(cur, ended)
  const durationMs = cur?.durationMs ?? null
  const remote = cur?.remote
  cur = null
  if (!play) return
  if (play.completed) session.last.set(play.trackId, 1)
  else if (play.listenedMs < SKIP_MS) {
    session.skips.set(play.trackId, (session.skips.get(play.trackId) ?? 0) + 1)
    session.last.set(play.trackId, -1)
  }
  if (play.completed || play.listenedMs >= SKIP_MS) {
    const before = session.heard.get(play.trackId)
    if (before !== undefined && play.startedAt - before <= REPLAY_GAP) session.replays.add(play.trackId)
    session.heard.set(play.trackId, play.startedAt)
  }
  if (usePickWhy.getState()[play.trackId]?.kind === 'new') {
    if (play.completed) session.explored.hits++
    else if (play.listenedMs < SKIP_MS) session.explored.misses++
  }
  if (remote) return
  api.recordPlay(play).catch(() => {})
  for (const f of listeners) f(play, durationMs)
}

/** Ends the previous listen (not completed), starts one for `trackId` (none = dropped file, untracked; `remote`: a catalog song). */
export function startListen(trackId: number | undefined, durationMs: number | null, remote = false) {
  endListen(false)
  if (trackId !== undefined) cur = { trackId, startedAt: Math.floor(Date.now() / 1000), heardMs: 0, lastMs: 0, durationMs, remote }
}

export function progress(positionMs: number, durationMs?: number | null) {
  if (!cur) return
  const step = positionMs - cur.lastMs
  // Polls come every ~250 ms; bigger jumps are seeks.
  if (step > 0 && step < 5000) cur.heardMs += step
  cur.lastMs = positionMs
  if (durationMs) cur.durationMs = durationMs
}
