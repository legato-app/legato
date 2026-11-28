/**
 * One round of arranging: the theme being edited, the moves and their history, drawn live (`useArrangeDraft`). Nothing
 * is written to the settings before Done.
 */
import { create } from 'zustand'
import { useArrangeDraft } from '../../app/arrangeDraft'
import { notifyError } from '../../app/notifyError'
import { useSettings } from '../../app/settings'
import { useStore } from '../../app/store'
import { tr } from '../../shared/i18n/i18n'
import { DEFAULT_LAYOUT, resolveLayout, type Placement } from '../../shared/theme/layout'
import { saveArrangement } from '../../shared/theme/saveArrangement'
import { PRESETS, type Theme } from '../../shared/theme/theme'
import { historyFrom, moved, redone, undone, type History } from './history'

export const useArrange = create<{ history: History }>(() => ({ history: historyFrom(DEFAULT_LAYOUT) }))

/** The theme picked, as saved (`current` patches the accent in); the System one under that name, for a copy of it. */
function pickedTheme(): Theme {
  const { settings, current } = useSettings.getState()
  const { id } = current()
  const theme = [...PRESETS, ...settings.customThemes].find((known) => known.id === id) ?? PRESETS[0]
  return settings.theme === 'system' ? { ...theme, name: tr('System') } : theme
}

function show(history: History) {
  useArrange.setState({ history })
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

const step = (change: (history: History) => History) => show(change(useArrange.getState().history))

/** A move made on the draft (`shared/theme/arrange.ts`). */
export const arrange = (next: Placement) => step((history) => moved(history, next))
export const undoMove = () => step(undone)
export const redoMove = () => step(redone)
/** The app's own arrangement. */
export const arrangeDefault = () => arrange(DEFAULT_LAYOUT)

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
