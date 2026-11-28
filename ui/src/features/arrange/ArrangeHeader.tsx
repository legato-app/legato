import { SlidersHorizontal } from '@phosphor-icons/react'
import { useArrangeDraft } from '../../app/arrangeDraft'
import { isRtl, tr, useLang } from '../../shared/i18n/i18n'
import type { ArtPlace } from '../../shared/theme/arrange'
import type { HeaderChoice, Placement } from '../../shared/theme/layout'
import { onMenu, type MenuEntry } from '../../shared/ui/ContextMenu'
import { useDrag } from '../../shared/ui/drag'
import type { DrawnBoxes } from './boxes'
import { DropZone, Eye, handleProps, PILL } from './handles'
import { ACTION_NAMES, ART_NAMES, LINE_NAMES } from './names'
import { chooseHeader, nudgeArt, placeArt } from './session'
import { artZones, type Box } from './zones'

export const HEADER_ART_ID = 'header-art'

const artHidden = () => useArrangeDraft.getState().draft?.pages.header?.art === 'none'

/** The art's handle covers it: dragged to before the title, after it or above, or moved with Alt and the arrows. */
function ArtHandle({ box, underDrag }: { box: Box; underDrag: boolean }) {
  const name = tr('Header art')
  const hiding = { allowed: () => true, hide: () => chooseHeader('art', { art: 'none' }), isHidden: artHidden }
  const through = underDrag ? 'pointer-events-none' : ''
  const props = handleProps({ id: HEADER_ART_ID, name, drag: { kind: 'arrange', scope: 'headerArt' }, directions: ['left', 'right', 'up'], move: nudgeArt, hiding })
  return (
    <>
      <button {...props} style={box} className={`fixed z-36 cursor-grab touch-none rounded-md border border-dashed border-ink-3 hover:bg-ink/10 focus-visible:bg-ink/10 ${through}`} />
      <Eye id={HEADER_ART_ID} name={name} box={box} hiding={hiding} className={through} />
    </>
  )
}

/** What the page headers can say another way, as a menu. `art`: this page's header draws one, or would. */
function headerEntries(choice: HeaderChoice | undefined, art: boolean): MenuEntry[] {
  const place = choice?.art ?? 'start'
  const places: MenuEntry[] = art
    ? [...(Object.entries(ART_NAMES) as [ArtPlace, string][]).map(([to, label]) => ({ label: tr(label), checked: place === to, onSelect: () => placeArt(to) })), '-']
    : []
  const lines = (Object.entries(LINE_NAMES) as ['kicker' | 'sub', string][]).map(([line, label]) => ({
    label: tr(label),
    checked: choice?.[line] !== false,
    onSelect: () => chooseHeader(line, { [line]: choice?.[line] === false }),
  }))
  const actions = (Object.entries(ACTION_NAMES) as [NonNullable<HeaderChoice['actions']>, string][]).map(([to, label]) => ({
    label: tr(label),
    checked: choice?.actions === to,
    // Picked again: the page's own.
    onSelect: () => chooseHeader('actions', { actions: choice?.actions === to ? undefined : to }),
  }))
  return [...places, ...lines, '-', ...actions]
}

/** The shown page's header: a menu for what it says, a handle on its art, and the drop zones while that is dragged. */
export function ArrangeHeader({ draft, header }: { draft: Placement; header: NonNullable<DrawnBoxes['header']> }) {
  const drag = useDrag((state) => state.data)
  const rightToLeft = useLang((state) => isRtl(state.lang))
  const choice = draft.pages.header
  const zones = drag?.kind === 'arrange' && drag.scope === 'headerArt' ? artZones(header.box, rightToLeft) : []
  const menu = onMenu(() => headerEntries(draft.pages.header, !!header.art || choice?.art === 'none'))
  return (
    <>
      {zones.map((zone) => (
        <DropZone key={zone.key} id={zone.key} box={zone.box} accepts={(data) => data.kind === 'arrange' && data.scope === 'headerArt'} drop={() => placeArt(zone.place)} />
      ))}
      {header.art && <ArtHandle box={header.art} underDrag={!!drag} />}
      <button
        type="button"
        aria-haspopup="menu"
        onClick={menu}
        onContextMenu={menu}
        // At the foot, in the middle: the corners are the art's, the top bar's handle is just above.
        style={{ left: header.box.left + header.box.width / 2, top: header.box.top + header.box.height - 4 }}
        className={`fixed z-37 -translate-x-1/2 -translate-y-full cursor-pointer! ${PILL} ${drag ? 'pointer-events-none opacity-50' : ''}`}
      >
        <SlidersHorizontal size={14} weight="bold" /> {tr('Page header')}
      </button>
    </>
  )
}
