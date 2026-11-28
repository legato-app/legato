import { ArrowCounterClockwise, ArrowUUpLeft, ArrowUUpRight, Check, Eye, Layout, X } from '@phosphor-icons/react'
import { useEffect } from 'react'
import { useArrangeDraft } from '../../app/arrangeDraft'
import { useSettings } from '../../app/settings'
import { tr } from '../../shared/i18n/i18n'
import { Button } from '../../shared/ui/Button'
import { RoundButton } from '../../shared/ui/controls'
import { onMenu } from '../../shared/ui/ContextMenu'
import { useDrag } from '../../shared/ui/drag'
import { usePlugins } from '../plugins/host'
import { ArrangeSurfaces, focusOnceDrawn } from './ArrangeSurfaces'
import { barKey } from './barKeys'
import { surfaceName } from './names'
import { arrangeDefault, discardArrangement, finishArranging, hideSurface, redoMove, undoMove, useArrange } from './session'

const RUN = { done: finishArranging, undo: undoMove, redo: redoMove }

/** The arranging mode over the app: the surfaces' handles, and a floating bar. Escape is Done. */
export default function ArrangeBar() {
  const canUndo = useArrange((state) => state.history.past.length > 0)
  const canRedo = useArrange((state) => state.history.future.length > 0)
  const layoutsOff = useSettings((state) => !state.settings.themeLayouts)
  const hidden = useArrangeDraft((state) => state.draft?.hidden)
  const plugins = usePlugins((state) => state.list)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const action = barKey(event)
      // A dialog or a menu over the app keeps its keys; a drag its Escape (`drag.ts`).
      if (!action || useDrag.getState().data || document.querySelector('[data-modal], [role="dialog"], [role="menu"]')) return
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
        {/* What is hidden has no handle: shown again from here. */}
        {hidden?.map((surface) => (
          <Button
            key={surface}
            data-show={surface}
            variant="ghost"
            onClick={() => {
              hideSurface(surface, surfaceName(surface, plugins))
              focusOnceDrawn(`[data-arrange="${surface}"]`)
            }}
          >
            <Eye size={14} /> {tr('Show {part}', { part: surfaceName(surface, plugins) })}
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
