/** The player as plugins see it (docs/plugins.md, API 2): no file paths, web covers only. */
import type { LibraryTrack } from '../../shared/api'
import type { NowPlaying } from '../player/store'

/** Songs of the queue handed out at most. */
const QUEUE_MAX = 500

// Rust's `art::public_cover`: public services only, never a personal server's address.
const COVER_HOSTS = ['i.ytimg.com', 'yt3.ggpht.com', 'i.scdn.co', 'mosaic.scdn.co', 'cdn-images.dzcdn.net', 'e-cdns-images.dzcdn.net', 'i1.sndcdn.com', 'i2.sndcdn.com', 'i3.sndcdn.com', 'i4.sndcdn.com']
const COVER_DOMAINS = ['.googleusercontent.com', '.mzstatic.com', '.spotifycdn.com']

export function publicCover(art: string | null | undefined): string | null {
  if (!art?.startsWith('https://') || !URL.canParse(art)) return null
  const { hostname } = new URL(art)
  return COVER_HOSTS.includes(hostname) || COVER_DOMAINS.some((domain) => hostname.endsWith(domain)) ? art : null
}

const libraryId = (id: number | undefined) => (id !== undefined && id > 0 ? id : null)

export function pluginTrack(now: NowPlaying, song: LibraryTrack | undefined, durationMs: number | null) {
  const youtubeId = now.youtubeId ?? null
  const page = youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : now.page?.startsWith('https://') ? now.page : null
  const art = publicCover(song?.art)
  return { title: now.title, artist: now.artist, trackId: libraryId(now.trackId), via: now.via, album: song?.album ?? null, durationMs, art, youtubeId, page }
}

/** The songs around the current one, in play order; `index` is the current one's place in `tracks`. */
export function pluginQueue(list: LibraryTrack[], order: number[], current: number) {
  const at = Math.max(0, order.indexOf(current))
  const from = Math.max(0, Math.min(at - QUEUE_MAX / 2, order.length - QUEUE_MAX))
  const tracks = order.slice(from, from + QUEUE_MAX).flatMap((i) => {
    const t = list[i]
    return t ? [{ trackId: libraryId(t.id), title: t.title, artist: t.artist, durationMs: t.durationMs }] : []
  })
  return { index: tracks.length ? at - from : -1, tracks }
}
