import { beforeEach, expect, it, vi } from 'vitest'
import { PRESETS, type Theme } from '../../shared/theme/theme'

const settings = { themeLayouts: true }
const answer = vi.fn()
const platform = vi.hoisted(() => ({ phoneApp: false }))
vi.mock('../../shared/platform', () => platform)
vi.mock('../../app/settings', () => ({ useSettings: { getState: () => ({ settings }) } }))
vi.mock('../../shared/ui/Ask', () => ({ askChoice: (question: unknown) => answer(question) }))
const { askAboutLayout } = await import('./themeLayoutImport')

const plain: Theme = PRESETS[0]
const arranged: Theme = { ...plain, layout: { v: 1, regions: { right: ['sidebar'] } } }

beforeEach(() => {
  settings.themeLayouts = true
  answer.mockReset()
})

it('asks nothing without a layout, with one that changes nothing, or with the setting off', async () => {
  expect(await askAboutLayout(plain)).toBe(plain)
  const same: Theme = { ...plain, layout: { v: 1, regions: { left: ['sidebar'] } } }
  expect(await askAboutLayout(same)).toBe(same)
  settings.themeLayouts = false
  expect(await askAboutLayout(arranged)).toBe(arranged)
  expect(answer).not.toHaveBeenCalled()
})

it('asks nothing on a phone and keeps the layout, for the PC', async () => {
  platform.phoneApp = true
  expect(await askAboutLayout(arranged)).toBe(arranged)
  expect(answer).not.toHaveBeenCalled()
  platform.phoneApp = false
})

it('lists the changes and takes the user’s pick', async () => {
  answer.mockResolvedValue('ok')
  expect(await askAboutLayout(arranged)).toBe(arranged)
  expect(answer.mock.calls[0][0].body).toContain('• The sidebar on the right')
  answer.mockResolvedValue('other')
  const colors = await askAboutLayout(arranged)
  expect(colors).not.toHaveProperty('layout')
  expect(colors).toMatchObject({ name: arranged.name, bg: arranged.bg })
  answer.mockResolvedValue(null)
  expect(await askAboutLayout(arranged)).toBeNull()
})
