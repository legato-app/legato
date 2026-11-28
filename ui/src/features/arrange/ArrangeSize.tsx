import { ArrowCounterClockwise } from '@phosphor-icons/react'
import { useRef } from 'react'
import { tr } from '../../shared/i18n/i18n'
import { SIZE_LIMITS, type SizedSurface } from '../../shared/theme/layout'
import { onMenu } from '../../shared/ui/ContextMenu'
import { previewSize, resizeSurface } from './session'
import type { Box } from './zones'

/** An arrow key's step, px. */
const KEY_STEP = 16

interface SizeProps {
  surface: SizedSurface
  name: string
  box: Box
  /** The arrangement's own; without one the column is as wide as the app draws it. */
  width: number | undefined
  underDrag: boolean
}

/**
 * A column's edge towards the page: dragged, or moved with the arrows, to set its width; double-click or Delete gives
 * back the app's own.
 */
export function ArrangeSize({ surface, name, box, width, underDrag }: SizeProps) {
  // `kept`: the arrangement's width as the drag started; `to`: the one dragged to, once the pointer moved.
  const drag = useRef<{ pointerX: number; width: number; kept: number | undefined; to?: number } | null>(null)
  // Seen on the window's left half, it grows rightwards: whatever the side and the reading direction call it.
  const growsRight = box.left + box.width / 2 < window.innerWidth / 2
  const shown = width ?? Math.round(box.width)
  const [min, max] = SIZE_LIMITS[surface]
  const usual = () => resizeSurface(surface, name, undefined)
  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={tr('Width of {part}', { part: name })}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={shown}
      aria-keyshortcuts="ArrowLeft ArrowRight Delete"
      title={tr('Drag it, or use the arrows; Delete gives back the usual width')}
      onContextMenu={onMenu(() => [{ label: tr('Usual width'), icon: <ArrowCounterClockwise size={16} />, disabled: width === undefined, onSelect: usual }])}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = { pointerX: event.clientX, width: shown, kept: width }
      }}
      onPointerMove={(event) => {
        const start = drag.current
        if (!start) return
        const travelled = event.clientX - start.pointerX
        // A press that doesn't move sets nothing.
        if (start.to === undefined && !travelled) return
        start.to = start.width + (growsRight ? travelled : -travelled)
        previewSize(surface, start.to)
      }}
      onPointerUp={() => {
        if (drag.current?.to !== undefined) resizeSurface(surface, name, drag.current.to)
        drag.current = null
      }}
      // Taken away by the system: back to the width it had.
      onPointerCancel={() => {
        if (drag.current?.to !== undefined) resizeSurface(surface, name, drag.current.kept)
        drag.current = null
      }}
      onDoubleClick={usual}
      onKeyDown={(event) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return
        if (event.key === 'Delete') return usual()
        const towards = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
        if (!towards) return
        event.preventDefault()
        resizeSurface(surface, name, shown + KEY_STEP * (growsRight ? towards : -towards))
      }}
      style={{ left: (growsRight ? box.left + box.width : box.left) - 4, top: box.top, height: box.height }}
      className={`fixed z-37 w-2 cursor-col-resize touch-none rounded-full bg-ink-3/50 hover:bg-ink focus-visible:bg-ink ${underDrag ? 'pointer-events-none opacity-50' : ''}`}
    />
  )
}
