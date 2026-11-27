import { describe, note, report, reportError } from '../shared/diag'
import { useScreen } from '../shared/screen'
import { useStore } from './store'

/** The interface held up this long says so. */
const STALL_MS = 1000

/**
 * Errors the interface meets, forwarded to the local diagnostics log (shared/diag.ts, nothing sent): uncaught errors,
 * unhandled promise rejections, and every error the interface shows in its alert (a failed command, a player failure:
 * errors.ts words the network ones in plain English). Also its stalls, and a phone leaving and coming back. Started
 * before the first render.
 */
export function startDiagnostics(): void {
  window.addEventListener('error', (e) => {
    // The browser's own noise: a resize observer that skipped a frame.
    if (/ResizeObserver loop/i.test(e.message)) return
    // Our own bundle: file name and place, no path.
    const where = e.filename ? ` at ${e.filename.split(/[/\\]/).pop()?.split('?')[0]}:${e.lineno}:${e.colno}` : ''
    const said = describe(e.error ?? e.message, 'Uncaught error')
    report('error', 'ui', said.message + where, said.detail)
  })
  window.addEventListener('unhandledrejection', (e) => reportError('ui', e.reason, 'Unhandled promise rejection', 'error'))
  useStore.subscribe((s, before) => {
    if (s.error && s.error !== before.error) reportError('ui', s.error, 'A command failed')
  })
  // Only a phone's shell says when the app leaves the screen (shared/screen.ts).
  useScreen.subscribe((s, before) => {
    if (s.on !== before.on) note('app', s.on ? 'came back' : 'went to the background')
  })
  // WebView2 and Android's WebView report long tasks; another engine would not.
  if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
    new PerformanceObserver((list) => {
      // Whole seconds: stalls alike are one line a minute (`throttled`), not thirty that push the errors out.
      for (const task of list.getEntries()) if (task.duration >= STALL_MS) report('warn', 'ui', `a stall of ${Math.round(task.duration / 1000)} s`)
    }).observe({ type: 'longtask' })
  }
}
