import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, DotsSixVertical, EyeSlash } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { useArrangeDraft } from '../../app/arrangeDraft'
import { isRtl, msg, tr, useLang } from '../../shared/i18n/i18n'
import type { Direction } from '../../shared/theme/arrange'
import { placesOf, type Placement, type Surface } from '../../shared/theme/layout'
import { onMenu } from '../../shared/ui/ContextMenu'
import { dragSource, useDrag, useDropTarget } from '../../shared/ui/drag'
import { usePlugins } from '../plugins/host'
import { surfaceKey } from './barKeys'
import { surfaceName } from './names'
import { hideSurface, nudgeSurface, placeSurface, useArrange } from './session'
import { dropZones, type Box, type Zone } from './zones'

/** Surfaces move, appear and grow as the app lives on: measured again this often while arranging. */
const MEASURE_MS = 300

/** Where each surface is drawn now (`data-surface`); one not on screen has no box. */
function measure(): Partial<Record<Surface, Box>> {
  const boxes: Partial<Record<Surface, Box>> = {}
  for (const element of document.querySelectorAll<HTMLElement>('[data-surface]')) {
    const { left, top, width, height } = element.getBoundingClientRect()
    if (width > 0 && height > 0) boxes[element.dataset.surface as Surface] = { left, top, width, height }
  }
  return boxes
}

function useSurfaceBoxes(draft: Placement) {
  const [boxes, setBoxes] = useState<Partial<Record<Surface, Box>>>({})
  useEffect(() => {
    const read = () => setBoxes((now) => (JSON.stringify(now) === JSON.stringify(measure()) ? now : measure()))
    // Once the move is drawn, then now and then.
    const frame = requestAnimationFrame(read)
    const timer = setInterval(read, MEASURE_MS)
    window.addEventListener('resize', read)
    return () => {
      cancelAnimationFrame(frame)
      clearInterval(timer)
      window.removeEventListener('resize', read)
    }
  }, [draft])
  return boxes
}

const ARROWS: [Direction, string, typeof ArrowLeft][] = [
  ['left', msg('Move left'), ArrowLeft],
  ['right', msg('Move right'), ArrowRight],
  ['up', msg('Move up'), ArrowUp],
  ['down', msg('Move down'), ArrowDown],
]

/** The keyboard's focus follows a hidden surface to its Show button, and back to its handle: each appears a moment later. */
export function focusOnceDrawn(selector: string, tries = 20) {
  const element = document.querySelector<HTMLElement>(selector)
  if (element) element.focus()
  else if (tries > 0) setTimeout(() => focusOnceDrawn(selector, tries - 1), MEASURE_MS / 5)
}

/** A surface's handle: dragged by the pointer, or moved with Alt and the arrows, Delete to hide. */
function Handle({ surface, name, box }: { surface: Surface; name: string; box: Box }) {
  const columns = placesOf(surface).includes('left')
  const bars = placesOf(surface).includes('bottom')
  const menu = onMenu(() => [
    ...ARROWS.filter(([direction]) => (direction === 'left' || direction === 'right' ? columns : bars)).map(([direction, label, Glyph]) => ({
      label: tr(label),
      icon: <Glyph size={16} />,
      onSelect: () => nudgeSurface(surface, name, direction),
    })),
    { label: tr('Hide'), icon: <EyeSlash size={16} />, onSelect: () => hideSurface(surface, name) },
  ])
  return (
    <button
      type="button"
      data-arrange={surface}
      aria-label={tr('Move {part}', { part: name })}
      aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown Delete"
      title={tr('Drag it, or use Alt and the arrows; Delete hides it')}
      onContextMenu={menu}
      onPointerDown={dragSource(
        () => ({ kind: 'arrange', scope: 'surface', id: surface }),
        () => name,
      )}
      onKeyDown={(event) => {
        const action = surfaceKey(event)
        if (!action) return
        // The app's own Alt+← (back) never sees it.
        event.preventDefault()
        event.stopPropagation()
        if (action !== 'hide') return nudgeSurface(surface, name, action)
        hideSurface(surface, name)
        // Refused (it stays): the handle keeps the focus.
        if (useArrangeDraft.getState().draft?.hidden.includes(surface)) focusOnceDrawn(`[data-show="${surface}"]`)
      }}
      style={{ left: box.left + box.width / 2, top: box.top + box.height / 2 }}
      className="fixed z-40 flex -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-medium whitespace-nowrap text-bg shadow-[0_8px_24px_var(--shadow)]"
    >
      <DotsSixVertical size={14} weight="bold" /> {name}
    </button>
  )
}

function DropZone({ zone, surface, name }: { zone: Zone; surface: Surface; name: string }) {
  useDropTarget(zone.key, {
    accepts: (data) => data.kind === 'arrange',
    drop: () => placeSurface(surface, name, zone.region, zone.at),
  })
  const over = useDrag((state) => state.target === zone.key)
  return <div data-drop={zone.key} aria-hidden style={zone.box} className={`fixed z-30 rounded-lg border-2 border-dashed ${over ? 'border-accent bg-accent/25' : 'border-transparent'}`} />
}

/** The surfaces' handles over the app, the drop zones while one is dragged, and each move said to screen readers. */
export function ArrangeSurfaces() {
  const draft = useArrangeDraft((state) => state.draft)!
  const said = useArrange((state) => state.said)
  const plugins = usePlugins((state) => state.list)
  const boxes = useSurfaceBoxes(draft)
  const dragged = useDrag((state) => (state.data?.kind === 'arrange' ? state.data.id : null))
  const rightToLeft = useLang((state) => isRtl(state.lang))
  const name = (surface: Surface) => surfaceName(surface, plugins)
  const zones = dragged ? dropZones(draft, dragged, boxes, { width: window.innerWidth, height: window.innerHeight }, rightToLeft) : []
  return (
    <>
      {zones.map((zone) => (
        <DropZone key={zone.key} zone={zone} surface={dragged!} name={name(dragged!)} />
      ))}
      {(Object.entries(boxes) as [Surface, Box][])
        .filter(([surface]) => !draft.hidden.includes(surface))
        .map(([surface, box]) => (
          <Handle key={surface} surface={surface} name={name(surface)} box={box} />
        ))}
      <p role="status" aria-live="polite" className="sr-only">
        {said}
      </p>
    </>
  )
}
