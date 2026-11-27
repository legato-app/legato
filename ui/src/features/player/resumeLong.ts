import { useStore } from '../../app/store'
import { tr } from '../../shared/i18n/i18n'
import { formatDuration } from '../../shared/format'
import { songKey } from './effects'
import { positionNow } from './Progress'
import { pointFor, withPoint, type Points } from './resumePoints'
import { usePlayer } from './store'
import { isObject, readStored, writeStored } from '../../shared/stored'

const STORE = 'legato.resume'
/** This PC's places (not synced: a file path means nothing on another PC). */
export const load = () => readStored<Points>(STORE, {}, isObject)
const save = (points: Points) => writeStored(STORE, points)

/** The song playing is a file of this PC or a personal server's: the only ones with a stable place to come back to. */
const mine = () => {
  const { now } = usePlayer.getState()
  return now && (now.via === 'local' || now.via === 'server') ? songKey(now) : null
}

/**
 * Long songs (audiobooks, podcasts, DJ sets: 20 minutes and more) are picked up where they were left: the place is kept
 * every 10 s and when paused, and the song starts there when played again, with a notice to start over.
 */
export function startResume(): () => void {
  let pending: string | null = null
  const keep = () => {
    const key = mine()
    const { durationMs, playing } = usePlayer.getState()
    if (!key || !durationMs || !playing) return
    save(withPoint(load(), key, positionNow(), durationMs, Date.now()))
  }
  const off = usePlayer.subscribe((s, prev) => {
    const key = mine()
    // A new start (a new `now`, set once the engine has the file), the same song played again included.
    if (s.now !== prev.now) pending = key
    else if (prev.playing && !s.playing) {
      // Paused: where it stopped (`keep` wants it playing, so the position is read here).
      if (key && s.durationMs) save(withPoint(load(), key, s.positionMs, s.durationMs, Date.now()))
    }
    if (pending && pending === key && s.durationMs && s.playing) {
      pending = null
      const at = pointFor(load(), key, s.durationMs)
      if (at !== null && s.positionMs < 5_000) {
        s.seek(at)
        useStore.getState().notify(tr('Resumed at {time}', { time: formatDuration(at) }), { action: { label: tr('Start over'), run: () => usePlayer.getState().seek(0) } })
      }
    }
  })
  const timer = setInterval(keep, 10_000)
  return () => (off(), clearInterval(timer))
}
