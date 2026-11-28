import { describe, expect, it, vi } from 'vitest'
import type { LibraryTrack } from '../../shared/api'
import { effectiveFade } from './fade'
import { usePlayer } from './store'

// Legato Lite (shared/edition.ts).
vi.mock('../../shared/edition', () => ({ LITE: true }))

const song = (id: number): LibraryTrack => ({ id, added: 0, addedAt: null, title: `Song ${id}`, artist: 'Artist', album: null, durationMs: 100_000, isrc: null, ids: { youtube: `video${id}` } })
// A full app's synced fade.
const advanced = { advanced: true, out: 8, in: 4, outCurve: 'linear', inCurve: 'linear', skip: true, pause: 300 } as const

describe('Lite plays one YouTube embed', () => {
  it('fades no song into the next, and keeps the pause fade', () => {
    expect(effectiveFade({ crossfade: 8, fade: { ...advanced, advanced: false } })).toMatchObject({ out: 0, in: 0, skip: false, pause: 0 })
    expect(effectiveFade({ crossfade: 8, fade: advanced })).toMatchObject({ out: 0, in: 0, skip: false, pause: 300 })
  })

  it('makes no second embed: nothing cued after 5 s, nothing overlapping at the end', () => {
    usePlayer.setState({ fade: effectiveFade({ crossfade: 8, fade: advanced }) })
    usePlayer.getState().playTracks([song(1), song(2)], 0)
    usePlayer.getState().onYoutube({ state: 1, time: 0.3, duration: 100 })
    usePlayer.getState().onYoutube({ state: 1, time: 6 })
    expect(usePlayer.getState().tail).toBeNull()
    usePlayer.getState().onYoutube({ state: 1, time: 96 })
    expect(usePlayer.getState().tail).toBeNull()
    expect(usePlayer.getState().now?.youtubeId).toBe('video1')
  })

  // In the tray nothing is painted: the embed's reports alone (no frame, no animation clock) must carry the queue on.
  it('plays three songs in a row on the embed’s reports alone', () => {
    usePlayer.setState({ fade: effectiveFade({ crossfade: 8, fade: advanced }) })
    usePlayer.getState().playTracks([song(1), song(2), song(3)], 0)
    const { frameKey } = usePlayer.getState()
    for (const id of [1, 2, 3]) {
      expect(usePlayer.getState()).toMatchObject({ playing: true, frameKey, now: { youtubeId: `video${id}` } })
      // As the same embed reports a video: not started yet (the moment "not playing" is said), playing, ended.
      usePlayer.getState().onYoutube({ state: -1 })
      usePlayer.getState().onYoutube({ state: 1, time: 0.3, duration: 100 })
      usePlayer.getState().onYoutube({ state: 1, time: 99.5 })
      usePlayer.getState().onYoutube({ state: 0 })
    }
  })

  it.each([
    ['at the song’s end', () => usePlayer.getState().onYoutube({ state: 0 })],
    ['on Next', () => usePlayer.getState().step(1)],
  ])('moves on in the same embed %s', (_when, moveOn) => {
    usePlayer.setState({ fade: effectiveFade({ crossfade: 8, fade: advanced }) })
    usePlayer.getState().playTracks([song(1), song(2)], 0)
    usePlayer.getState().onYoutube({ state: 1, time: 0.3, duration: 100 })
    usePlayer.getState().onYoutube({ state: 1, time: 6 })
    const { frameKey } = usePlayer.getState()
    moveOn()
    expect(usePlayer.getState()).toMatchObject({ frameKey, tail: null })
    expect(usePlayer.getState().now?.youtubeId).toBe('video2')
  })
})
