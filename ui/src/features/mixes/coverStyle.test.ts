import { describe, expect, it } from 'vitest'
import { coverStyleFor } from './coverStyle'

// The ids `crates/core/src/mixes.rs` makes.
const IDS = ['daylist', 'now', 'daily-1', 'daily-2', 'daily-3', 'daily-4', 'repeat', 'artist-1', 'artist-2', 'genre-1', 'decade-1', 'liked', 'supermix', 'weekday', 'fresh', 'gems', 'rediscover', 'fixation', 'discover', 'artist-3']

describe('coverStyleFor', () => {
  it('gives a mix the same look every time', () => {
    expect(IDS.map(coverStyleFor)).toEqual(IDS.map(coverStyleFor))
  })

  it('spreads the mixes over several looks', () => {
    expect(IDS).toHaveLength(20)
    expect(new Set(IDS.map(coverStyleFor)).size).toBeGreaterThanOrEqual(3)
  })

  it('never gives numbered neighbours the same look', () => {
    expect(new Set(['daily-1', 'daily-2', 'daily-3', 'daily-4'].map(coverStyleFor)).size).toBe(4)
  })
})
