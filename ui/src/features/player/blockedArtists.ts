/** "Never play this artist again": radio, mixes and autoplay pass over their songs. A song picked by hand still plays. */
import { allArtists } from '../library/filter'

const fold = (name: string) => name.trim().toLowerCase()

/** Any artist of the credit is one the user blocked. Rust's twin for the mixes: `mixes::artist_blocked`. */
export function artistBlocked(artist: string, blocked: readonly string[]): boolean {
  if (!blocked.length) return false
  const names = new Set(blocked.map(fold))
  return allArtists(artist).some((name) => names.has(fold(name)))
}

export const withoutBlocked = <T extends { artist: string }>(songs: T[], blocked: readonly string[]): T[] => (blocked.length ? songs.filter((song) => !artistBlocked(song.artist, blocked)) : songs)
