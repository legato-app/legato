import { beforeEach, expect, it, vi } from 'vitest'
import { moveSurface } from '../../shared/theme/arrange'
import { DEFAULT_LAYOUT } from '../../shared/theme/layout'
import { MAX_CUSTOM_THEMES, PRESETS, sanitize, sanitizeTheme, type Settings } from '../../shared/theme/theme'
import { useArrangeDraft } from '../../app/arrangeDraft'
import { arrange, beginArranging, discardArrangement, finishArranging, undoMove } from './session'

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
