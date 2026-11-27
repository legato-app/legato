import type { LibraryTrack } from '../../shared/api'
import { offered } from '../../shared/liteCuts'
import { pointFor, type Points } from '../player/resumePoints'

/** The library's books (Rust's rule, `audiobooks::BookRule`: marked only while Settings › Audiobooks is on). Longest first. */
export const pickBooks = (tracks: LibraryTrack[]): LibraryTrack[] => tracks.filter((t) => t.audiobook).sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))

/** A book out of the music, so out of the listening numbers: not a file listed with the books for its length only. */
export const leftMusic = (t: Pick<LibraryTrack, 'audiobook' | 'musicness'> | undefined): boolean => !!t?.audiobook && t.musicness === 'notMusic'

/** The library's lists of music without those books. The same list when there are none (memoized pages stay as they are),
 *  and in Lite: with no Audiobooks page, a book left out would show nowhere. */
export const withoutBooks = (tracks: LibraryTrack[]): LibraryTrack[] => (offered('audiobooks') && tracks.some(leftMusic) ? tracks.filter((t) => !leftMusic(t)) : tracks)

/** Where a book was left (from the resume points, key `t:<id>`): milliseconds and the share of the book, or null when it is not started. */
export function progress(points: Points, t: LibraryTrack): { ms: number; share: number } | null {
  const ms = t.durationMs ? pointFor(points, `t:${t.id}`, t.durationMs) : null
  return ms === null || !t.durationMs ? null : { ms, share: ms / t.durationMs }
}
