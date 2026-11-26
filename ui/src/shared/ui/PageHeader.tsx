import { cloneElement, isValidElement, useContext, type ReactNode } from 'react'
import { PageLayout } from './pageLayout'

/** The art redrawn at a theme's size (`Cover` and its like take `size`). */
const resized = (art: ReactNode, size: number | undefined) => (size && isValidElement<{ size?: number }>(art) && 'size' in art.props ? cloneElement(art, { size }) : art)

/**
 * Page header: optional kicker, title, subtitle, actions on the right. A page with art (album, artist, playlist) is a
 * band in the cover's tint (`tint`: palette variables from useCoverTint; the page's own colors until it's known), the
 * pane's full width from its top as in the mockups, then a row with the actions and `side` (sort, columns) on the right.
 * A theme's layout (`pages.header`) moves or leaves out the art and the small lines; `notice` (a legal line under the
 * subtitle) always shows.
 */
export function PageHeader({ kicker, title, sub, notice, actions, side, art, tint, backdrop, onContextMenu }: { kicker?: string; title: ReactNode; sub?: ReactNode; notice?: ReactNode; actions?: ReactNode; side?: ReactNode; art?: ReactNode; tint?: Record<string, string>; backdrop?: ReactNode; onContextMenu?: (e: React.MouseEvent) => void }) {
  const choice = useContext(PageLayout).header
  const kickerLine = choice?.kicker !== false && kicker && <p className="kicker">{kicker}</p>
  const shownSub = choice?.sub !== false && sub
  const subLine = (shownSub || notice) && (
    <div className="text-[0.8125rem] text-ink-2">
      {shownSub}
      {notice}
    </div>
  )
  if (art) {
    const place = choice?.art ?? 'start'
    const beside = choice?.actions === 'beside'
    const picture = place !== 'none' && (
      // The phone: the cover centered over the title, as phone players do.
      <div className="shrink-0 phone:self-center phone:*:size-40!">{resized(art, choice?.artSize)}</div>
    )
    const words = (
      <div className={`flex min-w-0 flex-col gap-2 ${backdrop ? 'max-w-[70%] phone:max-w-none' : ''} ${place === 'end' ? 'flex-1' : ''}`}>
        {kickerLine}
        {/* Display L (docs/design.md): Roboto Black, 56 / 60. Phone layout: 28, two lines, the cover above. */}
        <h1 className="truncate pb-1 text-[3.5rem] leading-[1.07] font-black tracking-[-0.015em] phone:line-clamp-2 phone:text-[1.75rem] phone:whitespace-normal">{title}</h1>
        {subLine}
      </div>
    )
    const buttons = (actions || side) && (
      <div className={beside ? 'ms-auto flex flex-wrap items-center justify-end gap-3' : 'flex flex-wrap items-center gap-3 px-6 py-5 phone:gap-1.5 phone:px-4 phone:py-3'}>
        {actions}
        {/* A narrow pane wraps it under the actions. */}
        {side && <div className="ms-auto flex min-w-0 flex-wrap items-center gap-2 phone:gap-1">{side}</div>}
      </div>
    )
    return (
      // The page's px-6 / pt-5 undone (main pane's edges); a page that scrolls around it gives it the same room.
      <div className="-mx-6 -mt-5 flex shrink-0 flex-col phone:-mx-4 phone:-mt-3">
        {/* `backdrop`: drawn behind the header at its own size (a playlist's wall of covers); the text goes white over it. */}
        <header onContextMenu={onContextMenu} style={backdrop ? undefined : tint} className={`relative flex min-w-0 gap-7 px-6 py-5 transition-colors duration-500 phone:flex-col phone:items-stretch phone:gap-3 phone:px-4 phone:pt-4 phone:pb-4 ${place === 'top' ? 'flex-col items-start' : 'items-end'} ${backdrop ? 'isolate overflow-hidden bg-bg text-white [&_.kicker]:text-white/85! [&_.text-ink-2]:text-white/90!' : 'bg-bg'}`}>
          {backdrop && (
            <div aria-hidden className="absolute inset-0 -z-10">
              {backdrop}
            </div>
          )}
          {place === 'end' ? words : picture}
          {place === 'end' ? picture : words}
          {beside && buttons}
        </header>
        {!beside && buttons}
      </div>
    )
  }
  return (
    // Actions under the title when both don't fit on a line (Stats' recap and periods in a narrow window, the phone).
    <header onContextMenu={onContextMenu} className={`flex shrink-0 gap-x-6 gap-y-3 pt-1 pb-4 phone:pb-3 ${choice?.actions === 'below' ? 'flex-col items-start' : 'flex-wrap items-end justify-between'}`}>
      <div className="flex min-w-0 flex-col gap-1">
        {kickerLine}
        {/* A page without a band (Songs, Albums, Stats…): 40 px, lighter than a band's Display L; the list starts higher. */}
        <h1 className="truncate pb-1 text-[2.5rem] leading-[1.1] font-black tracking-[-0.015em] phone:line-clamp-2 phone:text-[1.75rem] phone:whitespace-normal">{title}</h1>
        {subLine}
      </div>
      {actions && <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
