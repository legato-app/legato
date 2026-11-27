import { beforeEach, expect, it, vi } from 'vitest'
import { DEFAULTS, type Settings } from '../../shared/theme/theme'

let settings: Settings
const update = vi.fn((changes: Partial<Settings>) => void (settings = { ...settings, ...changes }))
const notify = vi.fn()
const question = vi.fn()
const layoutQuestion = vi.fn()
const PALETTE = ['bg', 'panel', 'raised', 'recess', 'line', 'lineSoft', 'ink', 'ink2', 'ink3', 'ink4', 'accent', 'onAccent', 'ledOff']
let file: Record<string, unknown>
vi.mock('../../app/settings', () => ({ useSettings: { getState: () => ({ settings, update }) } }))
vi.mock('../../app/store', () => ({ useStore: { getState: () => ({ notify }) } }))
vi.mock('../../shared/ui/Ask', () => ({ ask: () => question(), askChoice: () => layoutQuestion() }))
vi.mock('../../shared/api', () => ({ api: { importTheme: async () => file } }))
const { openDropped } = await import('./dropFiles')

const drop = () => openDropped('theme', 'C:\\x\\night.theme')

beforeEach(() => {
  settings = { ...DEFAULTS, theme: 'paper' }
  file = { name: 'Night', ...Object.fromEntries(PALETTE.map((key) => [key, '#112233'])) }
  update.mockClear()
  notify.mockClear()
  question.mockReset()
  layoutQuestion.mockReset()
})

it('applies a dropped theme at once, with an Undo its CSS cannot hide', async () => {
  await drop()
  expect(question).not.toHaveBeenCalled()
  expect(layoutQuestion).not.toHaveBeenCalled()
  expect(settings.customThemes.map((theme) => theme.name)).toEqual(['Night'])
  expect(settings.theme).toBe(settings.customThemes[0].id)
  const [, options] = notify.mock.calls[0]
  expect(options).toMatchObject({ guarded: true, action: { label: 'Undo' } })
  options.action.run()
  expect(settings).toMatchObject({ theme: 'paper', customThemes: [] })
})

it('asks first only when the theme rearranges the app, and a cancel changes nothing', async () => {
  file.layout = { v: 1, regions: { right: ['sidebar'] } }
  layoutQuestion.mockResolvedValue(null)
  await drop()
  expect(layoutQuestion).toHaveBeenCalledOnce()
  expect(update).not.toHaveBeenCalled()
  expect(notify).not.toHaveBeenCalled()
  layoutQuestion.mockResolvedValue('ok')
  await drop()
  expect(settings.customThemes).toHaveLength(1)
})
