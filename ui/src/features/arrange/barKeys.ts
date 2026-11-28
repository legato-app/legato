/** The arranging mode's keys. Pure. */
import type { Direction } from '../../shared/theme/arrange'

const ARROWS: Record<string, Direction> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }

/** A key on a handle: Alt and an arrow moves what it holds, Delete (or H) hides it. */
export function handleKey(event: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>): Direction | 'hide' | null {
  if (event.ctrlKey || event.metaKey || event.shiftKey) return null
  if (event.altKey) return ARROWS[event.code] ?? null
  return event.code === 'Delete' || event.code === 'KeyH' ? 'hide' : null
}

/** What a key does while arranging: Escape is Done, Ctrl+Z undoes, Ctrl+Y or Ctrl+Shift+Z redoes. Text fields keep theirs. */
export function barKey(event: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey' | 'target'>): 'done' | 'undo' | 'redo' | null {
  const typing = typeof Element !== 'undefined' && event.target instanceof Element && !!event.target.closest('input, textarea, select, [contenteditable]')
  if (typing || event.altKey) return null
  const command = event.ctrlKey || event.metaKey
  if (event.code === 'Escape') return command || event.shiftKey ? null : 'done'
  if (!command) return null
  if (event.code === 'KeyZ') return event.shiftKey ? 'redo' : 'undo'
  return event.code === 'KeyY' && !event.shiftKey ? 'redo' : null
}
