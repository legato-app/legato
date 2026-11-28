/** What the handles share: the keys, the pointer, the menu, the eye, the drop zones, the focus. */
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, EyeSlash } from '@phosphor-icons/react'
import type { ComponentProps } from 'react'
import { msg, tr } from '../../shared/i18n/i18n'
import type { Direction } from '../../shared/theme/arrange'
import { onMenu } from '../../shared/ui/ContextMenu'
import { dragSource, useDrag, useDropTarget, type DragData } from '../../shared/ui/drag'
import { handleKey } from './barKeys'
import { MEASURE_MS } from './boxes'
import type { Box } from './zones'

const ARROWS: [Direction, string, typeof ArrowLeft][] = [
  ['left', msg('Move left'), ArrowLeft],
  ['right', msg('Move right'), ArrowRight],
  ['up', msg('Move up'), ArrowUp],
  ['down', msg('Move down'), ArrowDown],
]

/** The keyboard's focus follows what was hidden to its Show button, and back to its handle: each appears a moment later. */
export function focusOnceDrawn(selector: string, tries = 20) {
  const element = document.querySelector<HTMLElement>(selector)
  if (element) element.focus()
  else if (tries > 0) setTimeout(() => focusOnceDrawn(selector, tries - 1), MEASURE_MS / 5)
}

export interface Movable {
  /** Names its handle (`data-arrange`) and its Show button (`data-show`). */
  id: string
  /** As the user reads it. */
  name: string
  drag: Extract<DragData, { kind: 'arrange' }>
  /** The ways its menu offers. */
  directions: readonly Direction[]
  move: (direction: Direction) => void
  /** Absent for what never hides; `allowed` is asked as the menu opens. */
  hiding?: { allowed: () => boolean; hide: () => void; isHidden: () => boolean }
}

/** Hides, and the keyboard's focus follows to the Show button (or stays, when it may not hide). */
export function hideAndFollow(id: string, hiding: NonNullable<Movable['hiding']>) {
  hiding.hide()
  focusOnceDrawn(hiding.isHidden() ? `[data-show="${id}"]` : `[data-arrange="${id}"]`)
}

/**
 * A handle's behaviour: dragged by the pointer, or moved with Alt and the arrows, Delete to hide; Enter opens its menu.
 * The keyboard's focus stays with what moved.
 */
export function handleProps({ id, name, drag, directions, move, hiding }: Movable) {
  const moveAndFollow = (direction: Direction) => {
    move(direction)
    focusOnceDrawn(`[data-arrange="${id}"]`)
  }
  const hide = () => hiding && hideAndFollow(id, hiding)
  const menu = onMenu(() => [
    ...ARROWS.filter(([direction]) => directions.includes(direction)).map(([direction, label, Glyph]) => ({ label: tr(label), icon: <Glyph size={16} />, onSelect: () => moveAndFollow(direction) })),
    hiding && { label: tr('Hide'), icon: <EyeSlash size={16} />, disabled: !hiding.allowed(), onSelect: hide },
  ])
  return {
    type: 'button',
    'data-arrange': id,
    'aria-label': tr('Move {part}', { part: name }),
    'aria-haspopup': 'menu',
    'aria-keyshortcuts': `Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown${hiding ? ' Delete' : ''}`,
    title: hiding ? tr('Drag it, or use Alt and the arrows; Delete hides it') : tr('Drag it, or use Alt and the arrows'),
    onContextMenu: menu,
    // A click made by Enter or Space (no pointer press counted); the pointer's own presses drag.
    onClick: (event) => {
      if (event.detail === 0) menu(event)
    },
    onPointerDown: dragSource(
      () => drag,
      () => name,
    ),
    onKeyDown: (event) => {
      const action = handleKey(event)
      if (!action) return
      // The app's own Alt+← (back) never sees it.
      event.preventDefault()
      event.stopPropagation()
      if (action === 'hide') hide()
      else moveAndFollow(action)
    },
  } satisfies ComponentProps<'button'> & { 'data-arrange': string }
}

/** A handle that names what it holds. */
export const PILL = 'flex cursor-grab touch-none items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-medium whitespace-nowrap text-bg shadow-[0_8px_24px_var(--shadow)]'

/** Half the eye's size: it stays whole inside the window. */
const EYE_REACH = 10

/** The eye on the corner of what can hide. */
export function Eye({ id, name, box, hiding, className }: { id: string; name: string; box: Box; hiding: NonNullable<Movable['hiding']>; className: string }) {
  const label = tr('Hide {part}', { part: name })
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => hideAndFollow(id, hiding)}
      style={{ left: Math.min(box.left + box.width, window.innerWidth - EYE_REACH), top: Math.max(box.top, EYE_REACH) }}
      className={`fixed z-38 flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-ink text-bg shadow-[0_2px_8px_var(--shadow)] ${className}`}
    >
      <EyeSlash size={12} weight="bold" />
    </button>
  )
}

export function DropZone({ id, box, accepts, drop }: { id: string; box: Box; accepts: (data: DragData) => boolean; drop: () => void }) {
  useDropTarget(id, { accepts, drop })
  const over = useDrag((state) => state.target === id)
  return <div data-drop={id} aria-hidden style={box} className={`fixed z-30 rounded-lg border-2 border-dashed ${over ? 'border-accent bg-accent/25' : 'border-transparent'}`} />
}
