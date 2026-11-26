import { describe, expect, it } from 'vitest'
import { artistBlocked, withoutBlocked } from './blockedArtists'
import { tasteFor } from './taste'

describe('artists never played again', () => {
  it('matches any credited artist, whole names only', () => {
    expect(artistBlocked('Band', ['band'])).toBe(true)
    expect(artistBlocked('Other feat. Band', ['Band'])).toBe(true)
    expect(artistBlocked('Band - Topic', ['Band'])).toBe(true)
    expect(artistBlocked('Bandits', ['Band'])).toBe(false)
    expect(artistBlocked('Band', [])).toBe(false)
  })
  it('the pickers pass over them', () => {
    const songs = [{ id: 1, artist: 'Band' }, { id: 2, artist: 'Other' }]
    expect(withoutBlocked(songs, ['Band'])).toEqual([songs[1]])
    const taste = tasteFor({}, new Map(), ['Band'])
    expect(songs.map((song) => taste.never(song as never))).toEqual([true, false])
  })
})
