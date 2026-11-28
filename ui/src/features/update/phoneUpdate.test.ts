import { expect, it, vi } from 'vitest'
import type { UpdateStatus } from '../../shared/api'

// The phone: Android's installer opens between two songs, not over one.
let hook: (() => boolean) | null = null
let onUpdate: ((s: UpdateStatus) => void) | null = null
const install = vi.fn(() => Promise.resolve())
const notify = vi.fn()
vi.mock('../../shared/platform', async (original) => ({ ...(await original<typeof import('../../shared/platform')>()), phoneApp: true }))
vi.mock('../../shared/diag', () => ({ note: () => {} }))
vi.mock('../../app/settings', () => ({ useSettings: { getState: () => ({ settings: { autoUpdate: true } }) } }))
vi.mock('../../app/store', () => ({ useStore: { getState: () => ({ notify }) } }))
vi.mock('../player/session', () => ({ saveSessionNow: () => Promise.resolve(), saveSessionAtNext: () => Promise.resolve(), thawSession: () => {} }))
vi.mock('../player/store', () => ({ usePlayer: { getState: () => ({ playing: true }) }, onSongEnd: (f: () => boolean) => void (hook = f) }))
vi.mock('../../shared/api', () => ({
  api: {
    updateStatus: () => new Promise(() => {}),
    onUpdate: (f: (s: UpdateStatus) => void) => ((onUpdate = f), Promise.resolve(() => {})),
    updateCheck: () => Promise.resolve(),
    updateInstall: install,
  },
}))

const { downloadUpdate, startUpdates } = await import('./updates')

it('a download asked for during a song installs as the song ends, the next one playing on', async () => {
  vi.useFakeTimers()
  startUpdates()
  downloadUpdate()
  onUpdate!({ state: 'ready', version: '1.2.200', notes: null, current: '1.2.199', lastCheck: null, lastUpdate: null, justUpdated: false } as UpdateStatus)
  await vi.runAllTimersAsync()
  expect(install).not.toHaveBeenCalled()
  expect(hook!()).toBe(false)
  await vi.runAllTimersAsync()
  expect(install).toHaveBeenCalledTimes(1)
  // Once: the next song's end opens nothing more.
  expect(hook!()).toBe(false)
  await vi.runAllTimersAsync()
  expect(install).toHaveBeenCalledTimes(1)
  vi.useRealTimers()
})
