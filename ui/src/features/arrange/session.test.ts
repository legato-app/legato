import { beforeEach, expect, it, vi } from 'vitest'
import { useLang } from '../../shared/i18n/i18n'
import { moveSurface } from '../../shared/theme/arrange'
import { DEFAULT_LAYOUT, PART_GROUPS, type PartedSurface } from '../../shared/theme/layout'
import { MAX_CUSTOM_THEMES, PRESETS, sanitize, sanitizeTheme, type Settings } from '../../shared/theme/theme'
import { useArrangeDraft } from '../../app/arrangeDraft'
import { PART_NAMES, surfaceName, whereIs } from './names'
import { arrange, beginArranging, discardArrangement, finishArranging, hidePart, hideSurface, nudgePart, nudgeSurface, placePart, placeSurface, redoMove, undoMove, useArrange } from './session'

const notify = vi.fn()
const settings = vi.hoisted(() => ({ now: {} as Settings, listeners: new Set<(state: { settings: Settings }) => void>() }))
vi.mock('../../app/store', () => ({ useStore: { getState: () => ({ notify }) } }))
vi.mock('../../app/settings', () => {
  const state = () => ({
    settings: settings.now,
    current: () => ({ id: settings.now.theme }),
    update: (changes: Partial<Settings>) => {
      settings.now = { ...settings.now, ...changes }
      settings.listeners.forEach((listener) => listener(state()))
    },
  })
  return {
    useSettings: {
      getState: state,
      subscribe: (listener: (state: { settings: Settings }) => void) => (settings.listeners.add(listener), () => void settings.listeners.delete(listener)),
    },
  }
})

const preset = PRESETS[0]
const right = moveSurface(DEFAULT_LAYOUT, 'sidebar', 'right')
const draft = () => useArrangeDraft.getState().draft

beforeEach(() => {
  discardArrangement()
  settings.now = { ...sanitize({}), theme: preset.id }
  notify.mockReset()
})

it('draws the moves, writes nothing before Done, then saves a copy with a way back', () => {
  beginArranging()
  arrange(right)
  expect(draft()).toBe(right)
  expect(settings.now.customThemes).toEqual([])
  undoMove()
  expect(draft()).toEqual(DEFAULT_LAYOUT)
  arrange(right)
  finishArranging()
  expect(draft()).toBeNull()
  expect(settings.now.customThemes.map((theme) => theme.name)).toEqual([`${preset.name} custom`])
  expect(settings.now.theme).toBe(settings.now.customThemes[0].id)
  const [text, options] = notify.mock.calls[0]
  expect(text).toBe(`Layout saved in ${preset.name} custom`)
  options.action.run()
  expect([settings.now.theme, settings.now.customThemes]).toEqual([preset.id, []])
})

it('says where a moved surface went, or that it can’t, each move undoable', () => {
  beginArranging()
  const said = () => useArrange.getState().said
  const name = surfaceName('sidebar', [])
  nudgeSurface('sidebar', name, 'right')
  expect([draft()?.regions.right, said()]).toEqual([['sidebar', 'sidePanel'], 'Sidebar on the right, 1 of 2'])
  placeSurface('sidebar', name, 'left', 0)
  expect(said()).toBe('Sidebar on the left')
  nudgeSurface('sidebar', name, 'left')
  expect(said()).toBe('Sidebar can’t go there')
  hideSurface('sidebar', name)
  expect([draft()?.hidden, said()]).toEqual([['sidebar'], 'Sidebar hidden'])
  hideSurface('topbar', surfaceName('topbar', []))
  expect(said()).toBe('Top bar can’t be hidden')
  hideSurface('sidebar', name)
  expect(said()).toBe('Sidebar on the left')
  undoMove()
  expect([draft()?.hidden, said()]).toEqual([['sidebar'], 'Sidebar hidden'])
  undoMove()
  expect(said()).toBe('Sidebar on the left')
  redoMove()
  expect(said()).toBe('Sidebar hidden')
})

it('says a refusal each time, and nothing for a drop where the surface already is', () => {
  beginArranging()
  const name = surfaceName('sidebar', [])
  const heard = () => [useArrange.getState().said, useArrange.getState().saidCount] as const
  nudgeSurface('sidebar', name, 'left')
  const [words, count] = heard()
  nudgeSurface('sidebar', name, 'left')
  expect(heard()).toEqual([words, count + 1])
  placeSurface('sidebar', name, 'left', 0)
  expect(heard()).toEqual([words, count + 1])
  expect(useArrange.getState().history.past).toEqual([])
})

it('names Undo and Redo themselves for a move about no single surface', () => {
  beginArranging()
  arrange(right)
  undoMove()
  expect(useArrange.getState().said).toBe('Undo')
  redoMove()
  expect(useArrange.getState().said).toBe('Redo')
})

it('moves and says sides as seen, right to left', () => {
  useLang.setState({ lang: 'he' })
  beginArranging()
  // Seen on the right, it goes left: towards the layout's right.
  nudgeSurface('sidebar', surfaceName('sidebar', []), 'left')
  expect(draft()?.regions.right).toEqual(['sidebar', 'sidePanel'])
  expect(useArrange.getState().said).toBe('Sidebar on the left, 1 of 2')
  useLang.setState({ lang: 'en' })
})

it('names a plugin’s panel after the plugin', () => {
  expect(surfaceName('plugin:example.panel', [{ id: 'example.panel', manifest: { name: 'Example' } }])).toBe('Example')
  expect(surfaceName('plugin:gone', [])).toBe('gone')
  expect(whereIs(DEFAULT_LAYOUT, 'brand', 'Logo')).toBe('Logo at the top, 1 of 2')
})

it('says nothing and writes nothing when Done finds nothing moved', () => {
  beginArranging()
  finishArranging()
  expect([draft(), settings.now.customThemes, notify.mock.calls]).toEqual([null, [], []])
})

it('starts over from another theme picked meanwhile, saying its moves are gone', () => {
  const other = sanitizeTheme({ ...preset, id: 'custom-b', name: 'B', layout: { v: 1, hidden: ['sidePanel'] } })!
  settings.now = { ...settings.now, customThemes: [other] }
  beginArranging()
  arrange(right)
  settings.now = { ...settings.now, theme: other.id }
  settings.listeners.forEach((listener) => listener({ settings: settings.now }))
  expect(draft()?.hidden).toEqual(['sidePanel'])
  expect(notify).toHaveBeenCalledOnce()
  // Left: later picks restart nothing.
  discardArrangement()
  settings.now = { ...settings.now, theme: preset.id }
  settings.listeners.forEach((listener) => listener({ settings: settings.now }))
  expect(draft()).toBeNull()
})

it('keeps the mode open when My themes is full', () => {
  const full = Array.from({ length: MAX_CUSTOM_THEMES }, (_, index) => sanitizeTheme({ ...preset, id: `custom-${index}`, name: `${index}` })!)
  settings.now = { ...settings.now, customThemes: full }
  beginArranging()
  arrange(right)
  finishArranging()
  expect(draft()).toBe(right)
  expect(notify.mock.calls[0][0]).toContain('24 themes at most')
})

it('moves and hides a bar’s parts, saying where each is, and saves them into the theme', () => {
  beginArranging()
  const said = () => useArrange.getState().said
  nudgePart('sidebar', 'library', 'Library', 'up', ['nav', 'library'])
  expect([draft()?.parts.sidebar?.order, said()]).toEqual([['library', 'nav'], 'Library, 1 of 2'])
  nudgePart('sidebar', 'library', 'Library', 'up', ['library', 'nav'])
  expect(said()).toBe('Library can’t go there')
  hidePart('playerBar', 'volume', 'Volume')
  expect([draft()?.parts.playerBar?.hidden, said()]).toEqual([['volume'], 'Volume hidden'])
  hidePart('sidebar', 'library', 'Library')
  expect(said()).toBe('Library can’t be hidden')
  undoMove()
  expect([draft()?.parts.playerBar, said()]).toEqual([undefined, 'Volume, 5 of 7'])
  // Dropped where it already is: nothing to say.
  const before = useArrange.getState().saidCount
  placePart('sidebar', 'library', 'Library', 0)
  expect(useArrange.getState().saidCount).toBe(before)
  finishArranging()
  expect(settings.now.customThemes[0].layout?.parts).toEqual({ sidebar: { order: ['library', 'nav'] } })
})

it('names every part a bar has', () => {
  for (const surface of Object.keys(PART_GROUPS) as PartedSurface[]) expect(Object.keys(PART_NAMES[surface]).sort()).toEqual([...PART_GROUPS[surface].flat()].sort())
})
