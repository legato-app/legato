/**
 * One round of arranging: the theme being edited, the moves and their history, drawn live (`useArrangeDraft`). Nothing
 * is written to the settings before Done.
 */
import { create } from 'zustand'
import { useArrangeDraft } from '../../app/arrangeDraft'
import { notifyError } from '../../app/notifyError'
import { useSettings } from '../../app/settings'
import { useStore } from '../../app/store'
import { isRtl, lang, tr } from '../../shared/i18n/i18n'
import { mirroredSide, moveSurface, stepSurface, toggleHidden, type Direction } from '../../shared/theme/arrange'
import { DEFAULT_LAYOUT, resolveLayout, type Placement, type Region, type Surface } from '../../shared/theme/layout'
import { saveArrangement } from '../../shared/theme/saveArrangement'
import { PRESETS, type Theme } from '../../shared/theme/theme'
import { historyFrom, moved, redone, undone, type History } from './history'
import { whereIs } from './names'

/**
 * `said`: the last move in words, for screen readers (the bar's live region). `saidCount` grows each time, so the same
 * words twice in a row are said twice.
 */
export const useArrange = create<{ history: History; said: string; saidCount: number }>(() => ({ history: historyFrom(DEFAULT_LAYOUT), said: '', saidCount: 0 }))

/** The surface whose move made a placement: Undo and Redo say where it is then. */
const movedSurfaces = new WeakMap<Placement, { surface: Surface; name: string }>()

const announce = (said: string) => useArrange.setState(({ saidCount }) => ({ said, saidCount: saidCount + 1 }))

/** The theme picked, as saved (`current` patches the accent in); the System one under that name, for a copy of it. */
function pickedTheme(): Theme {
  const { settings, current } = useSettings.getState()
  const { id } = current()
  const theme = [...PRESETS, ...settings.customThemes].find((known) => known.id === id) ?? PRESETS[0]
  return settings.theme === 'system' ? { ...theme, name: tr('System') } : theme
}

function show(history: History, said = '') {
  useArrange.setState({ history })
  announce(said)
  useArrangeDraft.setState({ draft: history.present })
}

/** From the theme's own arrangement, whether or not themes may arrange the app now (the bar says Done turns that on). */
const startOver = () => show(historyFrom(resolveLayout(pickedTheme().layout)))

let stopWatching = () => {}

export function beginArranging() {
  if (useArrangeDraft.getState().draft) return
  startOver()
  // Another theme picked meanwhile (Settings, a synced PC): arranged from its own layout, never saved with these moves.
  let picked = useSettings.getState().settings.theme
  stopWatching()
  stopWatching = useSettings.subscribe(({ settings }) => {
    if (settings.theme === picked || !useArrangeDraft.getState().draft) return
    picked = settings.theme
    const { history } = useArrange.getState()
    if (history.past.length) useStore.getState().notify(tr('Arranging another theme: moves not saved are gone'), { kind: 'info' })
    startOver()
  })
}

/** A move made on the draft (`shared/theme/arrange.ts`). */
export const arrange = (next: Placement) => show(moved(useArrange.getState().history, next))

/** After Undo or Redo: where the surface `move` was about is now, or `action` for a move about no single one. */
function showTravelled(history: History, move: Placement, action: string) {
  const about = movedSurfaces.get(move)
  show(history, about ? whereIs(history.present, about.surface, about.name) : action)
}

export function undoMove() {
  const { history } = useArrange.getState()
  const back = undone(history)
  if (back !== history) showTravelled(back, history.present, tr('Undo'))
}

export function redoMove() {
  const { history } = useArrange.getState()
  const forth = redone(history)
  if (forth !== history) showTravelled(forth, forth.present, tr('Redo'))
}

/** The app's own arrangement. */
export const arrangeDefault = () => arrange(DEFAULT_LAYOUT)

/** A surface moved or hidden, and said: where it is now, or that it can't (`name`: as the user reads it). */
function say(surface: Surface, name: string, next: Placement, refused: string) {
  const { history } = useArrange.getState()
  if (next === history.present) return announce(refused)
  movedSurfaces.set(next, { surface, name })
  show(moved(history, next), whereIs(next, surface, name))
}

const present = () => useArrange.getState().history.present
const cannotGo = (name: string) => tr('{part} can’t go there', { part: name })

/** Dropped by the pointer into `region`, at slot `at`. Zones only offer where it may go: unmoved, it was there already. */
export function placeSurface(surface: Surface, name: string, region: Region, at: number) {
  const next = moveSurface(present(), surface, region, at)
  if (next !== present()) say(surface, name, next, '')
}

/** Moved by an arrow key. */
export const nudgeSurface = (surface: Surface, name: string, direction: Direction) =>
  say(surface, name, stepSurface(present(), surface, mirroredSide(direction, isRtl(lang()))), cannotGo(name))

/** Hidden, or shown again. */
export const hideSurface = (surface: Surface, name: string) => say(surface, name, toggleHidden(present(), { surface }), tr('{part} can’t be hidden', { part: name }))

/** Leaves the mode, nothing saved. */
export function discardArrangement() {
  stopWatching()
  useArrangeDraft.setState({ draft: null })
}

/** Done: saved into a theme of the user's own, with a way back. A full list of themes keeps the mode open. */
export function finishArranging() {
  const { draft } = useArrangeDraft.getState()
  if (!draft) return
  const { settings, update } = useSettings.getState()
  const edited = pickedTheme()
  const saved = saveArrangement(settings, edited, draft, tr('{name} custom', { name: edited.name }))
  if (saved.kind === 'full') return void notifyError(new Error(tr('24 themes at most: remove one first.')))
  discardArrangement()
  if (saved.kind === 'unchanged') return
  update(saved.changes)
  const back = () => useSettings.getState().update(saved.undo(useSettings.getState().settings))
  useStore.getState().notify(tr('Layout saved in {name}', { name: saved.theme.name }), { action: { label: tr('Undo'), run: back } })
}
