import { describe, expect, it } from 'vitest'
import type { LibraryTrack } from '../../shared/api'
import { pluginQueue, pluginTrack } from './shapes'

const song = (id: number, art: string | null = null) => ({ id, title: `Song ${id}`, artist: 'Band', album: 'Record', durationMs: 1000, art }) as LibraryTrack

describe('what plugins see of the player', () => {
  it('a track: web covers only, the YouTube page, no path', () => {
    const now = { title: 'Song 1', artist: 'Band', via: 'local' as const, trackId: 1, path: 'C:/Music/a.flac' }
    expect(pluginTrack(now, song(1, 'art://local/1'), 1000)).toEqual({ title: 'Song 1', artist: 'Band', trackId: 1, via: 'local', album: 'Record', durationMs: 1000, art: null, youtubeId: null, page: null })
    expect(pluginTrack({ ...now, via: 'youtube', youtubeId: 'abc' }, song(1, 'https://example.com/a.jpg'), null)).toMatchObject({ art: 'https://example.com/a.jpg', page: 'https://www.youtube.com/watch?v=abc' })
  })
  it('the queue: in play order, 500 around the current song', () => {
    const list = Array.from({ length: 900 }, (_, i) => song(i + 1))
    const order = list.map((_, i) => i).reverse()
    expect(pluginQueue(list.slice(0, 3), [2, 0, 1], 0)).toEqual({ index: 1, tracks: [expect.objectContaining({ trackId: 3 }), expect.objectContaining({ trackId: 1 }), expect.objectContaining({ trackId: 2 })] })
    const window = pluginQueue(list, order, order[600])
    expect([window.tracks.length, window.tracks[window.index].trackId]).toEqual([500, order[600] + 1])
    expect(pluginQueue([], [], 0)).toEqual({ index: -1, tracks: [] })
  })
})
