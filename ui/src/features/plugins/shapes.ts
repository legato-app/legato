/** The player as plugins see it (docs/plugins.md, API 2): no file paths, web covers only. */
import type { LibraryTrack } from '../../shared/api'
import type { NowPlaying } from '../player/store'

/** Songs of the queue handed out at most. */
const QUEUE_MAX = 500

const libraryId = (id: number | undefined) => (id !== undefined && id > 0 ? id : null)

export function pluginTrack(now: NowPlaying, song: LibraryTrack | undefined, durationMs: number | null) {
  const youtubeId = now.youtubeId ?? null
  const page = youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : now.page?.startsWith('https://') ? now.page : null
  const art = song?.art?.startsWith('https://') ? song.art : null
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
