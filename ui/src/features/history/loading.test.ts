import { describe, expect, it } from 'vitest'
import { latestOnly, withNewest } from './loading'

const play = (startedAt: number) => ({ trackId: 1, startedAt, listenedMs: 1000, completed: true })
const times = (plays: { startedAt: number }[]) => plays.map((p) => p.startedAt)

describe('history loading', () => {
  it('drops an answer once a later request was made', () => {
    const ask = latestOnly()
    const paging = ask()
    expect(paging()).toBe(true)
    const reset = ask()
    expect([paging(), reset()]).toEqual([false, true])
  })
  it('puts the newest page over the older ones already loaded', () => {
    expect(times(withNewest([play(30), play(20), play(10)], [play(40), play(30)], 2))).toEqual([40, 30, 20, 10])
    // Not a full page: that is all there is, so a reset empties the list.
    expect(withNewest([play(30), play(20)], [], 2)).toEqual([])
    expect(times(withNewest([play(30)], [play(40)], 2))).toEqual([40])
  })
})
