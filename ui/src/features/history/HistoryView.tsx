import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSettings } from '../../app/settings'
import { useStore } from '../../app/store'
import { api, type LibraryTrack, type Play } from '../../shared/api'
import { trackArt } from '../../shared/art'
import { artistName } from '../../shared/artistName'
import { tr } from '../../shared/i18n/i18n'
import { usePhone } from '../../shared/phone'
import { onMenu } from '../../shared/ui/ContextMenu'
import { Cover } from '../../shared/ui/Cover'
import { PageHeader } from '../../shared/ui/PageHeader'
import { navMenu, trackMenu } from '../menus'
import { PlayingMark } from '../player/PlayingMark'
import { usePlayer } from '../player/store'
import { historyRows, type HistoryRow } from './days'
import { latestOnly, withNewest } from './loading'
import { ResetHistory } from './ResetHistory'

/** Plays asked for at a time. */
const PAGE = 200
const DAY_HEIGHT = 44
const PLAY_HEIGHT = 56

/** What you listened to, newest first, day by day. All from this device's history, the one the mixes read. */
export function HistoryView() {
  const tracks = useStore((s) => s.tracks)
  const play = usePlayer((s) => s.playTracks)
  const playingId = usePlayer((s) => s.now?.trackId)
  const phone = usePhone()
  const single = useSettings((s) => s.settings.clickToPlay === 'single') || phone
  const [plays, setPlays] = useState<Play[] | null>(null)
  const [more, setMore] = useState(true)
  const [ask] = useState(latestOnly)
  const paging = useRef(false)
  // Counts answers: a page dropped for a later request is asked for again if the end still shows.
  const [answers, setAnswers] = useState(0)

  const load = useCallback(
    (before: number | null) => {
      // One older page at a time; the newest page is asked again whenever something may have changed.
      if (before !== null && paging.current) return
      if (before !== null) paging.current = true
      const wanted = ask()
      api
        .historyPage(before, PAGE)
        .then(
          (page) => {
            if (!wanted()) return
            const full = page.length >= PAGE
            if (before !== null) {
              setMore(full)
              setPlays((shown) => [...(shown ?? []), ...page])
            } else {
              setMore((was) => full && was)
              setPlays((shown) => withNewest(shown ?? [], page, PAGE))
            }
          },
          (e: unknown) => {
            if (!wanted()) return
            setMore(false)
            useStore.setState({ error: String(e) })
          },
        )
        .finally(() => {
          if (before !== null) paging.current = false
          setAnswers((n) => n + 1)
        })
    },
    [ask],
  )
  // A new play (the library read its stats again), or the window back: today may be another day by now.
  const stats = useStore((s) => s.stats)
  useEffect(() => load(null), [load, stats])
  useEffect(() => {
    const again = () => load(null)
    window.addEventListener('focus', again)
    return () => window.removeEventListener('focus', again)
  }, [load])

  // The plays of songs still in the library, and their songs: the list playing from a row goes through.
  const { shown, songs } = useMemo(() => {
    const byId = new Map(tracks.map((t) => [t.id, t]))
    const shown = (plays ?? []).filter((p) => byId.has(p.trackId))
    return { shown, songs: shown.map((p) => byId.get(p.trackId) as LibraryTrack) }
  }, [plays, tracks])
  // `plays` is a new list at every answer: the day names are worked out again with it.
  const rows = useMemo(() => historyRows(shown, Date.now()), [shown])

  const scroller = useRef<HTMLDivElement>(null)
  const virtual = useVirtualizer({ count: rows.length, getScrollElement: () => scroller.current, estimateSize: (i) => (rows[i].kind === 'day' ? DAY_HEIGHT : PLAY_HEIGHT), getItemKey: (i) => keyOf(rows[i]), overscan: 10 })
  const visible = virtual.getVirtualItems()
  const atEnd = !!plays?.length && more && (visible.at(-1)?.index ?? 0) >= rows.length - 1
  const oldest = plays?.at(-1)?.startedAt ?? null
  useEffect(() => {
    if (atEnd) load(oldest)
  }, [atEnd, oldest, answers, load])

  const language = navigator.language
  const dayName = (row: Extract<HistoryRow, { kind: 'day' }>) => {
    if (row.name) return row.name === 'today' ? tr('Today') : tr('Yesterday')
    const date = new Date(row.day)
    return date.toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'long', year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })
  }

  return (
    <>
      <PageHeader
        title={tr('History')}
        sub={tr('From what you played in Legato')}
        actions={!!plays?.length && <ResetHistory onDone={() => load(null)} />}
        onContextMenu={onMenu(() => navMenu({ name: 'history' }))}
      />
      {plays && !rows.length && !more && <p className="py-16 text-center text-ink-3">{tr('Nothing played yet. What you listen to shows up here.')}</p>}
      <div ref={scroller} className="-mx-2 min-h-0 flex-1 overflow-y-auto px-2 pb-8">
        <div role="list" className="relative" style={{ height: virtual.getTotalSize() }}>
          {visible.map((item) => {
            const row = rows[item.index]
            const place = { height: item.size, transform: `translateY(${item.start}px)` }
            if (row.kind === 'day')
              return (
                <h2 key={item.key} className="kicker absolute inset-x-0 flex items-end px-2 pb-2" style={place}>
                  {dayName(row)}
                </h2>
              )
            const song = songs[row.index]
            const start = () => play(songs, row.index)
            return (
              <div key={item.key} role="listitem" className="absolute inset-x-0" style={place}>
                <button
                  type="button"
                  onClick={(e) => (single || e.detail === 0) && start()}
                  onDoubleClick={() => !single && start()}
                  onContextMenu={onMenu(() => trackMenu(song, { list: songs, index: row.index }))}
                  className="flex h-full w-full items-center gap-3.5 rounded-md px-2 text-start hover:bg-raised"
                >
                  <Cover title={song.album ?? song.title} art={trackArt(song)} size={40} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{song.title}</span>
                    <span className="truncate text-[0.8125rem] text-ink-2">{artistName(song.artist)}</span>
                  </span>
                  {song.id === playingId && <PlayingMark />}
                  {!row.play.completed && <span className="shrink-0 text-xs text-ink-3">{tr('Skipped')}</span>}
                  <time className="shrink-0 text-xs text-ink-3 tabular-nums" dateTime={new Date(row.play.startedAt * 1000).toISOString()}>
                    {new Date(row.play.startedAt * 1000).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}
                  </time>
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

/** Stable across pages: a day by its date, a play by when it started and its song. */
const keyOf = (row: HistoryRow) => (row.kind === 'day' ? `day-${row.day}` : `${row.play.startedAt}-${row.play.trackId}-${row.index}`)
