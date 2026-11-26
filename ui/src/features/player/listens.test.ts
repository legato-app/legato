import { expect, it, vi } from 'vitest'
import { api } from '../../shared/api'
import { closeBlind, openBlind } from '../blind/blindOpen'
import { endListen, onListenEnd, progress, session, startListen, toPlay } from './listens'

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: (p: string) => p, invoke: vi.fn(async () => undefined) }))

const listen = (heardMs: number, lastMs: number, durationMs: number | null = 200_000) => ({ trackId: 1, startedAt: 100, heardMs, lastMs, durationMs })

it('records completes, skips, ignores stray clicks', () => {
  expect(toPlay(listen(500, 500), false)).toBeNull()
  expect(toPlay(listen(10_000, 10_000), false)).toMatchObject({ listenedMs: 10_000, completed: false })
  expect(toPlay(listen(500, 500), true)).toMatchObject({ completed: true })
  // Seeked near the end and listened out: complete.
  expect(toPlay(listen(20_000, 185_000), false)).toMatchObject({ completed: true })
  expect(toPlay(listen(20_000, 185_000, null), false)).toMatchObject({ completed: false })
})

it('a blind test’s snippets are never plays, the song heard before it still is', () => {
  const record = vi.spyOn(api, 'recordPlay')
  record.mockClear()
  startListen(21, 200_000)
  progress(4000)
  openBlind()
  // The first snippet ends the song heard before the game.
  startListen(22, 200_000)
  expect(record.mock.calls.map(([play]) => play.trackId)).toEqual([21])
  progress(4000)
  closeBlind()
  // The last snippet ends after the game closed.
  endListen(false)
  expect(record).toHaveBeenCalledTimes(1)
  expect(session.last.has(22)).toBe(false)
  record.mockClear()
})

it('a catalog song (a radio pick) gives this session its verdict, never a stored play nor a listen to others', () => {
  const record = vi.spyOn(api, 'recordPlay')
  const heard = vi.fn()
  const off = onListenEnd(heard)
  startListen(-7, 200_000, true)
  progress(3000)
  endListen(false)
  startListen(-8, 200_000, true)
  endListen(true)
  expect([session.skips.get(-7), session.last.get(-7), session.last.get(-8)]).toEqual([1, -1, 1])
  expect(record).not.toHaveBeenCalled()
  expect(heard).not.toHaveBeenCalled()
  off()
})
