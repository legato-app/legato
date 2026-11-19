import { create } from 'zustand'

declare global {
  interface Window {
    legatoScreen?: (on?: boolean) => void
  }
}

/**
 * Whether the phone's screen shows the app. Android keeps the page "visible" so YouTube plays on (MainActivity.kt `KeepVisible`):
 * it never sees `visibilitychange`, so the shell tells it, `window.legatoScreen(true | false)` on resume and pause. Our own extras
 * (the visualizer, the moving cover, the clocks, the backdrop) rest while it is off; playback, the media session and sync do not.
 * The desktop never calls it: always on there (it has `visibilitychange`).
 */
export const useScreen = create<{ on: boolean }>(() => ({ on: true }))
export const screenOn = () => useScreen.getState().on

const listeners = new Set<(on: boolean) => void>()

/** Every call of `legatoScreen` (the screen on or off, or Sync Mode's plain "look again") to `fn`, with the state. Returns the way out. */
export function onScreen(fn: (on: boolean) => void): () => void {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

/** `win.legatoScreen`: the one function the shell calls, fanning out to the listeners. */
export function installScreen(win: { legatoScreen?: (on?: boolean) => void }) {
  win.legatoScreen = (on?: boolean) => {
    if (typeof on === 'boolean' && on !== useScreen.getState().on) useScreen.setState({ on })
    for (const l of [...listeners]) l(useScreen.getState().on)
  }
}

if (typeof window !== 'undefined') installScreen(window)
