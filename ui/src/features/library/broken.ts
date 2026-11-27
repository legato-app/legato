// Videos the player found unplayable for good (removed, private, blocked in the country: YouTube's own words), for the
// library health page. This PC's only, like the embed's refusals (`player/store.ts` blocked).
import { readStored, writeStored } from '../../shared/stored'
const KEY = 'legato-broken-videos'
const MAX = 1000

export interface BrokenVideo {
  video: string
  /** YouTube's reason, as the watch page said it. */
  why: string
  at: number
}

export const brokenVideos = () => readStored<BrokenVideo[]>(KEY, [], Array.isArray).filter((b) => typeof b?.video === 'string' && typeof b.why === 'string')

const keep = (list: BrokenVideo[]) => writeStored(KEY, list.slice(-MAX))

export function markBroken(video: string, why: string) {
  keep([...brokenVideos().filter((b) => b.video !== video), { video, why: why.slice(0, 200), at: Date.now() }])
}

/** Looked at again (another version picked, or the user says it plays now). */
export function forgetBroken(videos: string[]) {
  const gone = new Set(videos)
  keep(brokenVideos().filter((b) => !gone.has(b.video)))
}
