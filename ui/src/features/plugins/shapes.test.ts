import { describe, expect, it } from 'vitest'
import type { LibraryTrack } from '../../shared/api'
import { pluginQueue, pluginTrack, publicCover } from './shapes'

const song = (id: number, art: string | null = null) => ({ id, title: `Song ${id}`, artist: 'Band', album: 'Record', durationMs: 1000, art }) as LibraryTrack

describe('what plugins see of the player', () => {
  it('a track: web covers only, the YouTube page, no path', () => {
    const now = { title: 'Song 1', artist: 'Band', via: 'local' as const, trackId: 1, path: 'C:/Music/a.flac' }
    expect(pluginTrack(now, song(1, 'art://local/1'), 1000)).toEqual({ title: 'Song 1', artist: 'Band', trackId: 1, via: 'local', album: 'Record', durationMs: 1000, art: null, youtubeId: null, page: null })
    expect(pluginTrack({ ...now, via: 'youtube', youtubeId: 'abc' }, song(1, 'https://i.ytimg.com/vi/abc/hqdefault.jpg'), null)).toMatchObject({ art: 'https://i.ytimg.com/vi/abc/hqdefault.jpg', page: 'https://www.youtube.com/watch?v=abc' })
  })
  it('a personal server’s cover stays here', () => {
    const now = { title: 'Song 1', artist: 'Band', via: 'server' as const, trackId: 1 }
    expect(pluginTrack(now, song(1, 'https://music.example.net/rest/getCoverArt.view?id=al-1'), 1000).art).toBeNull()
    expect(pluginTrack(now, song(1, 'https://is1-ssl.mzstatic.com/a/600x600bb.jpg'), 1000).art).not.toBeNull()
  })
  it('the same public covers as Rust', () => {
    for (const art of ['https://www.gstatic.com/youtube/media/ytm/images/pbg/liked-songs-delhi-576.png', 'https://coverartarchive.org/release-group/76df3287/front-250', 'https://archive.org/download/mbid-1/mbid-1-2_thumb250.jpg', 'https://ia800000.us.archive.org/3/items/mbid-1/mbid-1-2_thumb250.jpg', 'https://music.youtube.com/image/mixart?r=EN']) expect(publicCover(art)).toBe(art)
    for (const art of ['https://www.gstatic.com/other/x.png', 'https://coverartarchive.org/other', 'https://archive.org/details/anything', 'https://evil.archive.org.example/mbid-1/x.jpg', 'https://music.youtube.com/watch?v=x', 'https://cdn.discordapp.com/avatars/1/a.png']) expect(publicCover(art)).toBeNull()
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
