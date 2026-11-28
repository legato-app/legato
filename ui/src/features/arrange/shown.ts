/** What has handles now: what is drawn and not covered. Pure. */
import type { PartOwner } from '../../shared/theme/arrange'
import { PAGE_PARTS, PART_GROUPS, type PartedPage, type PartedSurface, type Surface } from '../../shared/theme/layout'

/** Pages no layout arranges: the way back, the permission review. */
const KEPT_PAGES = ['settings', 'addons']
const NOW_PLAYING: readonly PartedPage[] = ['nowPlayingColumns', 'nowPlaying', 'nowPlayingControls']

export interface Screen {
  /** The page's name (`store.ts`). */
  view: string
  /** Now Playing is up: over everything but the top bar. */
  nowPlaying: boolean
  /** The surfaces the draft hides. */
  hidden: readonly Surface[]
}

/** The owners whose parts have handles: containers first, their handles under those of what they hold. */
export function ownersShown({ view, nowPlaying, hidden }: Screen): PartOwner[] {
  const bars = (Object.keys(PART_GROUPS) as PartedSurface[]).filter((bar) => !hidden.includes(bar))
  if (nowPlaying) return [...bars.filter((bar) => bar === 'topbar'), ...NOW_PLAYING]
  if (KEPT_PAGES.includes(view)) return bars
  const page = view in PAGE_PARTS && !NOW_PLAYING.includes(view as PartedPage) ? [view as PartedPage] : []
  // The page's blocks before the columns its lists show.
  return [...bars, ...page, 'columns']
}

export const surfaceHasHandle = (surface: Surface, { nowPlaying, hidden }: Screen) => !hidden.includes(surface) && (!nowPlaying || surface === 'topbar' || surface === 'brand')

export const headerHasHandle = ({ view, nowPlaying }: Screen) => !nowPlaying && !KEPT_PAGES.includes(view)
