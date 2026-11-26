/** The history page's rows: each day's name, then its plays. */
import type { Play } from '../../shared/api'

export type HistoryRow =
  /** `day`: that day's local midnight (ms). */
  | { kind: 'day'; day: number; name: 'today' | 'yesterday' | null }
  | { kind: 'play'; play: Play; /** Its place among the plays: where playing from it starts. */ index: number }

const midnight = (ms: number) => new Date(ms).setHours(0, 0, 0, 0)

/** `plays` newest first → rows, grouped by the day they started on, in this device's time. */
export function historyRows(plays: Play[], now: number): HistoryRow[] {
  const today = midnight(now)
  // Through a date, not minus 24 h: a clock change makes a day 23 or 25 hours.
  const yesterday = midnight(today - 1)
  const rows: HistoryRow[] = []
  let day: number | null = null
  plays.forEach((play, index) => {
    const of = midnight(play.startedAt * 1000)
    if (of !== day) {
      day = of
      rows.push({ kind: 'day', day, name: day === today ? 'today' : day === yesterday ? 'yesterday' : null })
    }
    rows.push({ kind: 'play', play, index })
  })
  return rows
}
