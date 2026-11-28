import { openUrl } from '@tauri-apps/plugin-opener'
import { create } from 'zustand'
import { useSettings } from '../../app/settings'
import { useStore } from '../../app/store'
import { api, type UpdateStatus } from '../../shared/api'
import { nextIndex } from '../player/queue'
import { saveSessionAtNext, saveSessionNow, thawSession } from '../player/session'
import { vias } from '../player/sources'
import { onSongEnd, usePlayer } from '../player/store'
import { tr } from '../../shared/i18n/i18n'
import { note } from '../../shared/diag'
import { phoneApp } from '../../shared/platform'
import { notifyError } from '../../app/notifyError'
import { releasePage } from '../../shared/links'

/** What the background updater is doing (Settings › About). */
export const useUpdate = create<{ status: UpdateStatus | null }>(() => ({ status: null }))

// A quiet moment: nothing played for 15 s and no click or key for a minute.
const SILENT_MS = 15_000
const UNTOUCHED_MS = 60_000
const LOOK_EVERY = 5_000

// The phone: a download the user asked for (the toast's Update, About's Download update) goes to Android's installer
// once there. Never unasked: the installer asks them anyway, and mobile data.
let wanted = false
// Versions already offered this run.
const offered = new Set<string>()
// The phone: downloaded while a song played, Android's installer waits for its end (2026-11-19, the owner: the update
// between two songs didn't seem to work there; it opened over the song).
let atEnd = false

/** The phone: download the version found (announced first), then Android's installer; already downloaded: the installer. */
export function downloadUpdate() {
  if (useUpdate.getState().status?.state === 'ready') return void installUpdate()
  wanted = true
  void api.updateCheck().catch(() => {})
}

/**
 * Pure: what the phone does on an updater status: offer a new version once; asked for, download it (a check was
 * running as the user tapped), install it once there, or say it failed.
 */
export function phoneStep(s: UpdateStatus, asked: boolean, said: ReadonlySet<string>): 'offer' | 'download' | 'install' | 'failed' | null {
  if (s.state === 'available') return asked ? 'download' : said.has(s.version) ? null : 'offer'
  if (s.state === 'ready' && asked) return 'install'
  if (s.state === 'error' && asked) return 'failed'
  return null
}

function onPhone(s: UpdateStatus) {
  const step = phoneStep(s, wanted, offered)
  // Nothing newer after all: a later version waits for its own tap.
  if (s.state === 'upToDate') wanted = false
  const { notify } = useStore.getState()
  if (step === 'offer' && s.state === 'available') {
    offered.add(s.version)
    notify(tr('Legato {version} is available', { version: s.version }), { kind: 'info', action: { label: tr('Update'), run: downloadUpdate } })
  } else if (step === 'download') void api.updateCheck().catch(() => {})
  else if (step === 'install' && usePlayer.getState().playing) {
    atEnd = true
    note('update', 'downloaded on the phone: installs as this song ends')
    notify(tr('The update installs as this song ends'), { kind: 'info' })
  } else if (step === 'install') void installUpdate()
  else if (step === 'failed') {
    wanted = false
    notify(tr('Couldn’t download the update'), { kind: 'error' })
  }
}

/** The new version's page in the browser: a copy that can't install it (a Linux .deb) is updated from there. */
export const openReleasePage = (version: string) => void openUrl(releasePage(version)).catch(notifyError)

/** Pure: the version such a copy tells of now, each one once. */
export function versionToTell(status: UpdateStatus, installsItself: boolean, said: ReadonlySet<string>): string | null {
  return !installsItself && status.state === 'available' && !said.has(status.version) ? status.version : null
}

function tellOfRelease(version: string) {
  offered.add(version)
  useStore.getState().notify(tr('Legato {version} is available', { version }), { kind: 'info', action: { label: tr('Download update'), run: () => openReleasePage(version) } })
}

/** Install the downloaded update: session saved first (or the next song, between two), the app closes and comes back. */
export async function installUpdate(next?: number) {
  const s = useUpdate.getState().status
  if (s?.state !== 'ready') return
  // The phone: Android's installer asks first and may be cancelled, the app goes on meanwhile. Saved for the new
  // version's first launch, saving goes on.
  if (phoneApp) {
    wanted = false
    await saveSessionNow()
    thawSession()
    return api.updateInstall().catch((e) => void notifyError(e))
  }
  useStore.getState().notify(tr('Updating to {version}… back in a few seconds', { version: s.version }), { kind: 'info' })
  await (next === undefined ? saveSessionNow() : saveSessionAtNext(next))
  await api.updateInstall().catch((e) => {
    thawSession()
    notifyError(e)
  })
}

/** Pure: may an update install between two songs? Not while someone is using the app. */
export function betweenSongs(now: number, lastInput: number): boolean {
  return now - lastInput >= UNTOUCHED_MS
}

/** Pure: what a ready update does as a song ends on its own (the PC). */
export function atSongEnd(ready: boolean, automatic: boolean, untouched: boolean, next: number | null): 'install' | 'not ready' | 'automatic updates off' | 'touched lately' | 'no next song' {
  if (!ready) return 'not ready'
  if (!automatic) return 'automatic updates off'
  if (!untouched) return 'touched lately'
  return next === null ? 'no next song' : 'install'
}

/** Pure: may an update install now? */
export function quietNow(now: number, { playing, lastSound, lastInput }: { playing: boolean; lastSound: number; lastInput: number }): boolean {
  return !playing && now - lastSound >= SILENT_MS && now - lastInput >= UNTOUCHED_MS
}

/** Follows the updater; with automatic updates on, a ready update installs at the first quiet moment (the PC; the phone
 * offers it). Returns cleanup. */
export function startUpdates(): () => void {
  // Asked once; the first check comes seconds after the launch, well after the answer.
  let installsItself = true
  if (!phoneApp)
    void api
      .desktopSupport()
      .then((support) => void (installsItself = support.selfUpdate))
      .catch(() => {})
  const set = (status: UpdateStatus) => {
    useUpdate.setState({ status })
    if (phoneApp) return onPhone(status)
    const version = versionToTell(status, installsItself, offered)
    if (version) tellOfRelease(version)
  }
  void api
    .updateStatus()
    .then(set)
    .catch(() => {})
  const off = api.onUpdate(set)
  const stop = phoneApp ? startPhone() : startInstalling()
  return () => {
    stop()
    void off.then((f) => f())
  }
}

/** The phone: an update downloaded during a song goes to Android's installer as the song ends; the next song plays on
 * meanwhile (the installer asks first, and may be cancelled). Returns cleanup. */
function startPhone(): () => void {
  onSongEnd(() => {
    if (!atEnd) return false
    atEnd = false
    note('update', 'between two songs: Android’s installer opens')
    // After the step: the session saved is the next song's.
    setTimeout(() => void installUpdate(), 0)
    return false
  })
  return () => onSongEnd(null)
}

/** The PC: a ready update installs between two songs or at a quiet moment, automatic updates on. Returns cleanup. */
function startInstalling(): () => void {
  let lastSound = Date.now()
  let lastInput = Date.now()
  const touched = () => void (lastInput = Date.now())
  window.addEventListener('pointerdown', touched)
  window.addEventListener('keydown', touched)
  const unsub = usePlayer.subscribe((s) => {
    if (s.playing) lastSound = Date.now()
  })
  // A song ended on its own: install there, the next song starts once the app is back (a few seconds of silence, never
  // a cut in a song).
  onSongEnd(() => {
    const state = useUpdate.getState().status?.state
    const { order, index, repeat, list } = usePlayer.getState()
    const next = nextIndex(order, index, 1, repeat, true, (j) => !list[j] || !vias(list[j]).length)
    const step = atSongEnd(state === 'ready', useSettings.getState().settings.autoUpdate, betweenSongs(Date.now(), lastInput), next)
    // Said when there is an update to speak of: found, coming or there.
    if (state === 'ready' || state === 'available' || state === 'downloading') note('update', `a song ended: ${step === 'install' ? 'installing' : step}`)
    if (step !== 'install' || next === null) return false
    void installUpdate(next)
    return true
  })
  const look = setInterval(() => {
    const ready = useUpdate.getState().status?.state === 'ready'
    if (!ready || !useSettings.getState().settings.autoUpdate) return
    if (quietNow(Date.now(), { playing: usePlayer.getState().playing, lastSound, lastInput })) void installUpdate()
  }, LOOK_EVERY)
  return () => {
    clearInterval(look)
    onSongEnd(null)
    unsub()
    window.removeEventListener('pointerdown', touched)
    window.removeEventListener('keydown', touched)
  }
}
