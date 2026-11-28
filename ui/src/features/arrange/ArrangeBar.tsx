import { ArrowCounterClockwise, ArrowUUpLeft, ArrowUUpRight, Check, Eye, Layout, X } from '@phosphor-icons/react'
import { useEffect } from 'react'
import { useArrangeDraft } from '../../app/arrangeDraft'
import { useSettings } from '../../app/settings'
import { useStore } from '../../app/store'
import { tr } from '../../shared/i18n/i18n'
import { hiddenParts } from '../../shared/theme/arrange'
import { Button } from '../../shared/ui/Button'
import { RoundButton } from '../../shared/ui/controls'
import { onMenu } from '../../shared/ui/ContextMenu'
import { useDrag } from '../../shared/ui/drag'
import { usePlayer } from '../player/store'
import { usePlugins } from '../plugins/host'
import { HEADER_ART_ID } from './ArrangeHeader'
import { ArrangeSurfaces } from './ArrangeSurfaces'
import { barKey } from './barKeys'
import { focusOnceDrawn } from './handles'
import { partName, surfaceName } from './names'
import { arrangeDefault, chooseHeader, discardArrangement, finishArranging, hidePart, hideSurface, redoMove, undoMove, useArrange } from './session'
import { headerHasHandle, ownersShown } from './shown'

const RUN = { done: finishArranging, undo: undoMove, redo: redoMove }

/** The arranging mode over the app: the handles, and a floating bar. Escape is Done. */
export default function ArrangeBar() {
  const canUndo = useArrange((state) => state.history.past.length > 0)
  const canRedo = useArrange((state) => state.history.future.length > 0)
  const layoutsOff = useSettings((state) => !state.settings.themeLayouts)
  const draft = useArrangeDraft((state) => state.draft)
  const plugins = usePlugins((state) => state.list)
  const view = useStore((state) => state.view.name)
  const nowPlaying = usePlayer((state) => state.full)
  const screen = { view, nowPlaying, hidden: draft?.hidden ?? [] }
  // What is hidden has no handle: shown again from the bar. Surfaces, then the parts of what is on screen, then the art.
  const hiddenThings = draft
    ? [
        ...draft.hidden.map((surface) => ({ id: surface as string, name: surfaceName(surface, plugins), show: () => hideSurface(surface, surfaceName(surface, plugins)) })),
        ...ownersShown(screen).flatMap((owner) => hiddenParts(draft, owner).map((part) => ({ id: `part:${owner}:${part}`, name: partName(owner, part), show: () => hidePart(owner, part, partName(owner, part)) }))),
        ...(headerHasHandle(screen) && draft.pages.header?.art === 'none' ? [{ id: HEADER_ART_ID, name: tr('Header art'), show: () => chooseHeader('art', { art: 'start' }) }] : []),
      ]
    : []
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const action = barKey(event)
      // A dialog or a menu over the app keeps its keys; a drag its Escape (`drag.ts`). Now Playing is arranged too.
      if (!action || useDrag.getState().data || document.querySelector('[data-modal], [role="dialog"]:not([data-now-playing]), [role="menu"]')) return
      event.preventDefault()
      event.stopPropagation()
      RUN[action]()
    }
    // Capture: Escape ends the mode before it closes anything under the bar.
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])
  const menu = onMenu(() => [
    { label: tr('Undo'), icon: <ArrowUUpLeft size={16} />, disabled: !canUndo, onSelect: undoMove },
    { label: tr('Redo'), icon: <ArrowUUpRight size={16} />, disabled: !canRedo, onSelect: redoMove },
    { label: tr('Default layout'), icon: <Layout size={16} />, onSelect: arrangeDefault },
    '-',
    { label: tr('Discard'), icon: <X size={16} />, onSelect: discardArrangement },
    { label: tr('Done'), icon: <Check size={16} />, onSelect: finishArranging },
  ])
  return (
    <>
      <ArrangeSurfaces />
      {/* data-brand: a theme's CSS can't hide the way out. */}
      <div role="toolbar" aria-label={tr('Arranging the app')} data-brand="" onContextMenu={menu} className="fixed bottom-24 left-1/2 z-40 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-full border border-line bg-raised py-2 ps-4 pe-2 shadow-[0_8px_30px_var(--shadow)]">
        <p className="text-[0.8125rem] font-medium">
          {tr('Drag a part to move it')}
          {layoutsOff && <span className="ms-2 text-xs font-normal text-ink-2">{tr('Done turns themes’ arrangements back on')}</span>}
        </p>
        <RoundButton label={tr('Undo')} size="sm" disabled={!canUndo} onClick={undoMove}>
          <ArrowUUpLeft size={16} />
        </RoundButton>
        <RoundButton label={tr('Redo')} size="sm" disabled={!canRedo} onClick={redoMove}>
          <ArrowUUpRight size={16} />
        </RoundButton>
        {hiddenThings.map(({ id, name, show }) => (
          <Button
            key={id}
            data-show={id}
            variant="ghost"
            onClick={() => {
              show()
              focusOnceDrawn(`[data-arrange="${id}"]`)
            }}
          >
            <Eye size={14} /> {tr('Show {part}', { part: name })}
          </Button>
        ))}
        <Button variant="ghost" onClick={arrangeDefault}>
          <ArrowCounterClockwise size={14} /> {tr('Default layout')}
        </Button>
        <Button variant="ghost" onClick={discardArrangement}>
          {tr('Discard')}
        </Button>
        <Button onClick={finishArranging}>{tr('Done')}</Button>
      </div>
    </>
  )
}
