import type { LibraryTrack } from '../../shared/api'
import { pointFor, type Points } from '../player/resumePoints'

/** The library's books (Rust's rule, `audiobooks::BookRule`: marked only while Settings › Audiobooks is on). Longest first. */
export const pickBooks = (tracks: LibraryTrack[]): LibraryTrack[] => tracks.filter((t) => t.audiobook).sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))

/** Where a book was left (from the resume points, key `t:<id>`): milliseconds and the share of the book, or null when it is not started. */
export function progress(points: Points, t: LibraryTrack): { ms: number; share: number } | null {
  const ms = t.durationMs ? pointFor(points, `t:${t.id}`, t.durationMs) : null
  return ms === null || !t.durationMs ? null : { ms, share: ms / t.durationMs }
}
