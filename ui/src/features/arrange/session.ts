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
import { artStep, mirroredSide, moveInGroup, moveSurface, partGroup, partStep, setHeader, setSize, stepPart, stepSurface, toggleHidden, type ArtPlace, type Direction, type PartOwner } from '../../shared/theme/arrange'
import { DEFAULT_LAYOUT, resolveLayout, type HeaderChoice, type Placement, type Region, type SizedSurface, type Surface } from '../../shared/theme/layout'
import { saveArrangement } from '../../shared/theme/saveArrangement'
import { PRESETS, type Theme } from '../../shared/theme/theme'
import { historyFrom, moved, redone, undone, type History } from './history'
import { whereIs, whereIsHeader, whereIsPart, widthOf } from './names'

/**
 * `said`: the last move in words, for screen readers (the bar's live region). `saidCount` grows each time, so the same
 * words twice in a row are said twice. `filled`: the parts (`owner:part`) with something to show, on screen or scrolled
 * away; null until they are measured.
 */
export const useArrange = create<{ history: History; said: string; saidCount: number; filled: readonly string[] | null }>(() => ({ history: historyFrom(DEFAULT_LAYOUT), said: '', saidCount: 0, filled: null }))

/** The parts of `part`'s container with something to show; every one while nothing is measured. */
function filledParts(owner: PartOwner, part: string): string[] {
  const { filled } = useArrange.getState()
  return partGroup(owner, part).filter((other) => !filled || filled.includes(`${owner}:${other}`))
}

/** Where what was moved is, in any placement. */
type Whereabouts = (placement: Placement) => string
/** What each move was about: Undo and Redo say where it is then. */
const movedThings = new WeakMap<Placement, Whereabouts>()

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

/** After Undo or Redo: where what `move` was about is now, or `action` for a move about no single thing. */
function showTravelled(history: History, move: Placement, action: string) {
  show(history, movedThings.get(move)?.(history.present) ?? action)
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

/** Something moved or hidden, and said: where it is now, or that it can't (`refused`). */
function say(next: Placement, whereabouts: Whereabouts, refused: string) {
  const { history } = useArrange.getState()
  if (next === history.present) return announce(refused)
  movedThings.set(next, whereabouts)
  show(moved(history, next), whereabouts(next))
}

// `name`, here and below: as the user reads it.
const ofSurface = (surface: Surface, name: string): Whereabouts => (placement) => whereIs(placement, surface, name)
const ofPart = (owner: PartOwner, part: string, name: string): Whereabouts => (placement) => whereIsPart(placement, owner, part, name, filledParts(owner, part))

const present = () => useArrange.getState().history.present
const cannotGo = (name: string) => tr('{part} can’t go there', { part: name })
const cannotHide = (name: string) => tr('{part} can’t be hidden', { part: name })

/** Dropped by the pointer into `region`, at slot `at`. Zones only offer where it may go: unmoved, it was there already. */
export function placeSurface(surface: Surface, name: string, region: Region, at: number) {
  const next = moveSurface(present(), surface, region, at)
  if (next !== present()) say(next, ofSurface(surface, name), '')
}

/** Moved by an arrow key. */
export const nudgeSurface = (surface: Surface, name: string, direction: Direction) =>
  say(stepSurface(present(), surface, mirroredSide(direction, isRtl(lang()))), ofSurface(surface, name), cannotGo(name))

/** Hidden, or shown again. */
export const hideSurface = (surface: Surface, name: string) => say(toggleHidden(present(), { surface }), ofSurface(surface, name), cannotHide(name))

/** A part dropped by the pointer, at slot `at` of its container. */
export function placePart(owner: PartOwner, part: string, name: string, at: number) {
  const next = moveInGroup(present(), owner, part, at)
  if (next !== present()) say(next, ofPart(owner, part, name), '')
}

/** A part moved by an arrow key, past the next one with something to show. */
export function nudgePart(owner: PartOwner, part: string, name: string, direction: Direction) {
  const step = partStep(owner, part, direction, isRtl(lang()))
  say(step ? stepPart(present(), owner, part, step, filledParts(owner, part)) : present(), ofPart(owner, part, name), cannotGo(name))
}

/** A part hidden, or shown again. */
export const hidePart = (owner: PartOwner, part: string, name: string) => say(toggleHidden(present(), { owner, part }), ofPart(owner, part, name), cannotHide(name))

/** The page headers' choice changed, about its `key`. Nothing to say when it was so already. */
export function chooseHeader(key: keyof HeaderChoice, change: Partial<HeaderChoice>) {
  const next = setHeader(present(), change)
  if (next !== present()) say(next, (placement) => whereIsHeader(placement, key), '')
}

/** The art dropped by the pointer. */
export const placeArt = (place: ArtPlace) => chooseHeader('art', { art: place })

/** The art moved by an arrow key. */
export const nudgeArt = (direction: Direction) => placeArt(artStep(direction, isRtl(lang())))

/** A column's width while its edge is dragged: drawn, not yet a move. */
export const previewSize = (surface: SizedSurface, width: number) => useArrangeDraft.setState({ draft: setSize(present(), surface, width) })

/** A column given a width (undefined: the app's own again), as one move. */
export function resizeSurface(surface: SizedSurface, name: string, width: number | undefined) {
  const next = setSize(present(), surface, width)
  // Dragged back to where it was: the preview goes.
  if (next === present()) return void useArrangeDraft.setState({ draft: next })
  say(next, (placement) => widthOf(placement, surface, name), '')
}

/** Leaves the mode, nothing saved. */
export function discardArrangement() {
  stopWatching()
  useArrange.setState({ filled: null })
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
