import { afterEach, expect, it, vi } from 'vitest'
import { useScreen } from '../shared/screen'
import { startDiagnostics } from './diagnostics'

const { report, note } = vi.hoisted(() => ({ report: vi.fn(), note: vi.fn() }))
vi.mock('../shared/diag', () => ({ report, note }))
vi.mock('./store', () => ({ useStore: { subscribe: vi.fn() } }))
afterEach(() => vi.unstubAllGlobals())

type Tasks = (list: { getEntries: () => { duration: number }[] }) => void

it('logs a stall of a second or more, and a phone leaving and coming back', () => {
  let tasks: Tasks = () => {}
  vi.stubGlobal(
    'PerformanceObserver',
    class {
      static supportedEntryTypes = ['longtask']
      constructor(heard: Tasks) {
        tasks = heard
      }
      observe() {}
    },
  )
  vi.stubGlobal('window', { addEventListener: vi.fn() })
  startDiagnostics()
  tasks({ getEntries: () => [{ duration: 999 }, { duration: 1503 }, { duration: 1904.7 }] })
  // The same words for both: said once by `throttled`.
  expect(report.mock.calls).toEqual([['warn', 'ui', 'a stall of 2 s'], ['warn', 'ui', 'a stall of 2 s']])
  useScreen.setState({ on: false })
  useScreen.setState({ on: true })
  expect(note.mock.calls).toEqual([['app', 'went to the background'], ['app', 'came back']])
})
