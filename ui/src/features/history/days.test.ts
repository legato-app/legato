import { describe, expect, it } from 'vitest'
import { historyRows } from './days'

// Local times: the grouping follows this device's days.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).getTime()
const play = (ms: number) => ({ trackId: 1, startedAt: ms / 1000, listenedMs: 1000, completed: true })

describe('history rows', () => {
  it('names today and yesterday, splits at local midnight, keeps each play’s place', () => {
    const plays = [play(at(26, 0, 1)), play(at(25, 23, 59)), play(at(25, 8)), play(at(20, 12))]
    expect(historyRows(plays, at(26, 9)).map((row) => (row.kind === 'day' ? (row.name ?? new Date(row.day).getDate()) : row.index))).toEqual(['today', 0, 'yesterday', 1, 2, 20, 3])
  })
  it('has nothing to show without plays', () => {
    expect(historyRows([], at(26, 9))).toEqual([])
  })
})
