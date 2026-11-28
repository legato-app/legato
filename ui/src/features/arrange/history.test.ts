import { expect, it } from 'vitest'
import { moveSurface, toggleHidden } from '../../shared/theme/arrange'
import { DEFAULT_LAYOUT } from '../../shared/theme/layout'
import { barKey, handleKey } from './barKeys'
import { HISTORY_LIMIT, historyFrom, moved, redone, undone } from './history'

const right = moveSurface(DEFAULT_LAYOUT, 'sidebar', 'right')
const hidden = toggleHidden(right, { surface: 'sidePanel' })

it('undoes and redoes moves, a new one dropping what could be redone', () => {
  const start = historyFrom(DEFAULT_LAYOUT)
  expect([undone(start), redone(start), moved(start, DEFAULT_LAYOUT)]).toEqual([start, start, start])
  const two = moved(moved(start, right), hidden)
  expect(undone(two).present).toBe(right)
  expect(undone(undone(two)).present).toBe(DEFAULT_LAYOUT)
  expect(redone(undone(two))).toEqual(two)
  const branched = moved(undone(two), DEFAULT_LAYOUT)
  expect(branched.future).toEqual([])
  expect(redone(branched)).toBe(branched)
})

it('keeps a bounded past', () => {
  let history = historyFrom(DEFAULT_LAYOUT)
  for (let move = 0; move < HISTORY_LIMIT + 5; move++) history = moved(history, { ...history.present })
  expect(history.past).toHaveLength(HISTORY_LIMIT)
})

it('reads a handle’s keys', () => {
  const key = (code: string, held: Partial<Record<'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey', boolean>> = {}) => handleKey({ code, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...held })
  expect([key('ArrowLeft', { altKey: true }), key('ArrowDown', { altKey: true }), key('Delete'), key('KeyH')]).toEqual(['left', 'down', 'hide', 'hide'])
  // A plain arrow moves the focus' way, Ctrl+Alt is the app's global keys.
  expect([key('ArrowLeft'), key('ArrowLeft', { altKey: true, ctrlKey: true }), key('Delete', { shiftKey: true }), key('Enter')]).toEqual([null, null, null, null])
})

it('reads the mode’s keys', () => {
  const key = (code: string, held: Partial<Record<'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey', boolean>> = {}) => barKey({ code, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, target: null, ...held })
  expect([key('Escape'), key('KeyZ', { ctrlKey: true }), key('KeyZ', { ctrlKey: true, shiftKey: true }), key('KeyY', { ctrlKey: true })]).toEqual(['done', 'undo', 'redo', 'redo'])
  expect([key('KeyZ'), key('Escape', { shiftKey: true }), key('KeyZ', { ctrlKey: true, altKey: true }), key('Space')]).toEqual([null, null, null, null])
})
