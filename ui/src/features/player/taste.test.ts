import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TasteSignal } from '../../shared/api'

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: (p: string) => p, invoke: vi.fn(async () => undefined) }))

const signal = (id: number, extra: Partial<TasteSignal> = {}): TasteSignal => ({ id, playsDecayed: 0, playsLong: 0, lastPlayed: 0, skipsRecent: 0, liked: false, less: false, never: false, hours: 0, replays: 0, near: [], ...extra })

describe('the taste store', () => {
  beforeEach(() => vi.resetModules())

  it('loads at start, keeps the answer by id, and keeps the old one when a load fails', async () => {
    const { loadTaste, useTaste } = await import('./taste')
    expect(useTaste.getState().loaded).toBe(false)
    await loadTaste(async () => [signal(1, { never: true }), signal(2, { skipsRecent: 3 })])
    expect(useTaste.getState().loaded).toBe(true)
    expect(useTaste.getState().signals.get(1)?.never).toBe(true)
    expect(useTaste.getState().signals.get(9)).toBeUndefined()
    await loadTaste(async () => Promise.reject(new Error('x')))
    expect(useTaste.getState().signals.get(2)?.skipsRecent).toBe(3)
  })

  it('loads again every 20 listens, not before', async () => {
    const { startTaste, RELOAD_EVERY } = await import('./taste')
    const { startListen, endListen } = await import('./listens')
    const ask = vi.fn(async () => [signal(1)])
    const stop = startTaste(ask)
    expect(ask).toHaveBeenCalledTimes(1)
    const listen = () => {
      startListen(1, 200_000)
      endListen(true)
    }
    for (let i = 0; i < RELOAD_EVERY - 1; i++) listen()
    expect(ask).toHaveBeenCalledTimes(1)
    listen()
    expect(ask).toHaveBeenCalledTimes(2)
    stop()
    for (let i = 0; i < RELOAD_EVERY; i++) listen()
    expect(ask).toHaveBeenCalledTimes(2)
  })
})

describe('this session’s replays (before the next reload)', () => {
  beforeEach(() => vi.resetModules())
  const track = (id: number) => ({ id }) as never

  it('a song heard again within a day counts as a like at once; once, or two days apart, does not', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-25T10:00:00Z') })
    const { tasteFor } = await import('./taste')
    const { startListen, endListen } = await import('./listens')
    const hear = (id: number) => {
      startListen(id, 200_000)
      endListen(true)
    }
    hear(1)
    hear(2)
    hear(3)
    vi.advanceTimersByTime(3 * 3600_000)
    hear(1)
    vi.advanceTimersByTime(2 * 86_400_000)
    hear(3)
    const liked = tasteFor({}, new Map()).liked ?? (() => false)
    expect([liked(track(1)), liked(track(2)), liked(track(3))]).toEqual([true, false, false])
    vi.useRealTimers()
  })

  it('a song last heard a few hours before the signals were read, heard again now, counts too', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-25T10:00:00Z') })
    const now = Math.floor(Date.now() / 1000)
    const { tasteFor } = await import('./taste')
    const { startListen, endListen } = await import('./listens')
    startListen(1, 200_000)
    endListen(true)
    startListen(2, 200_000)
    endListen(true)
    const signals = new Map([signal(1, { lastPlayed: now - 3 * 3600 }), signal(2, { lastPlayed: now - 3 * 86_400 })].map((x) => [x.id, x]))
    const liked = tasteFor({}, signals).liked ?? (() => false)
    expect([liked(track(1)), liked(track(2))]).toEqual([true, false])
    vi.useRealTimers()
  })
})
