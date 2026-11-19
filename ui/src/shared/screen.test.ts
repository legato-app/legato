import { describe, expect, it, vi } from 'vitest'
import { installScreen, screenOn, onScreen, useScreen } from './screen'

describe('the phone screen state', () => {
  it('Kotlin tells the page: legatoScreen(false) off, legatoScreen(true) on; the state follows', () => {
    const win: { legatoScreen?: (on?: boolean) => void } = {}
    installScreen(win)
    win.legatoScreen!(false)
    expect(screenOn()).toBe(false)
    expect(useScreen.getState().on).toBe(false)
    win.legatoScreen!(true)
    expect(screenOn()).toBe(true)
  })
  it('every listener hears every event, with the state; one that leaves is not called', () => {
    const win: { legatoScreen?: (on?: boolean) => void } = {}
    installScreen(win)
    const a = vi.fn()
    const b = vi.fn()
    const offA = onScreen(a)
    onScreen(b)
    win.legatoScreen!(false)
    offA()
    win.legatoScreen!(true)
    expect(a.mock.calls).toEqual([[false]])
    expect(b.mock.calls).toEqual([[false], [true]])
  })
  it('a call with no argument (an older shell) keeps the state and still reaches the listeners (Sync Mode’s wake)', () => {
    const win: { legatoScreen?: (on?: boolean) => void } = {}
    installScreen(win)
    win.legatoScreen!(true)
    const l = vi.fn()
    onScreen(l)
    win.legatoScreen!()
    expect(l).toHaveBeenCalledWith(true)
    expect(screenOn()).toBe(true)
  })
})
