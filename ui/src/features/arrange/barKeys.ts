/** The arranging mode's keys. Pure. */

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
