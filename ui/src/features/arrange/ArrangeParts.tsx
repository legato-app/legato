import { DotsSixVertical } from '@phosphor-icons/react'
import { useArrangeDraft } from '../../app/arrangeDraft'
import { isRtl, useLang } from '../../shared/i18n/i18n'
import { canHidePart, hiddenParts, holdsParts, mirrorsParts, orderedContainers, orderedParts, partAxis, partGroup, type PartOwner } from '../../shared/theme/arrange'
import type { Placement } from '../../shared/theme/layout'
import { useDrag } from '../../shared/ui/drag'
import type { DrawnBoxes } from './boxes'
import { DropZone, Eye, handleProps, PILL } from './handles'
import { partName } from './names'
import { hidePart, nudgePart, placePart } from './session'
import { partZones, type Box } from './zones'

/** A page's big blocks: outlined, the pointer passing through (the page still scrolls), their handle a pill in a corner.
 *  A part that holds others has its pill above it, theirs covering most of it. The other parts are small: the handle
 *  covers them. */
const BLOCKS: readonly PartOwner[] = ['album', 'artist', 'songs', 'albums', 'artists', 'home', 'nowPlayingColumns']

/** A pill's height: above a part at the window's top, it stays inside. */
const PILL_HEIGHT = 28

interface PartProps {
  owner: PartOwner
  part: string
  box: Box
  underDrag: boolean
}

/** A part's handle, with an eye on its corner for the ones that can hide. */
function PartHandle({ owner, part, box, underDrag }: PartProps) {
  const name = partName(owner, part)
  const id = `part:${owner}:${part}`
  const hiding = canHidePart(owner, part)
    ? { allowed: () => true, hide: () => hidePart(owner, part, name), isHidden: () => isHidden(owner, part) }
    : undefined
  const through = underDrag ? 'pointer-events-none' : ''
  const holds = holdsParts(owner, part)
  const props = handleProps({
    id,
    name,
    drag: { kind: 'arrange', scope: 'part', owner, id: part },
    directions: partAxis(owner, part) === 'down' ? ['up', 'down'] : ['left', 'right'],
    move: (direction) => nudgePart(owner, part, name, direction),
    hiding,
  })
  return (
    <>
      {BLOCKS.includes(owner) || holds ? (
        <>
          <div aria-hidden style={box} className="pointer-events-none fixed z-35 rounded-md border border-dashed border-ink-3" />
          <button
            {...props}
            style={holds ? { left: box.left, top: Math.max(box.top, PILL_HEIGHT) } : { left: box.left + 4, top: box.top + 4 }}
            className={`fixed z-37 ${PILL} ${holds ? '-translate-y-full' : ''} ${through} ${underDrag ? 'opacity-50' : ''}`}
          >
            <DotsSixVertical size={14} weight="bold" /> {name}
          </button>
        </>
      ) : (
        <button {...props} style={box} className={`fixed z-36 cursor-grab touch-none rounded-md border border-dashed border-ink-3 hover:bg-ink/10 focus-visible:bg-ink/10 ${through}`} />
      )}
      {hiding && <Eye id={id} name={name} box={box} hiding={hiding} className={through} />}
    </>
  )
}

function isHidden(owner: PartOwner, part: string) {
  const { draft } = useArrangeDraft.getState()
  return !!draft && hiddenParts(draft, owner).includes(part)
}

/** The parts' handles over the app, and the drop zones while one is dragged. `owners`: those with handles now. */
export function ArrangeParts({ draft, owners, boxes }: { draft: Placement; owners: PartOwner[]; boxes: DrawnBoxes['parts'] }) {
  const drag = useDrag((state) => state.data)
  const rightToLeft = useLang((state) => isRtl(state.lang))
  const dragged = drag?.kind === 'arrange' && drag.scope === 'part' ? drag : null
  const boxOf = (owner: PartOwner, part: string): Box | undefined => boxes[`${owner}:${part}`]
  const zones = dragged
    ? partZones(
        orderedParts(draft, dragged.owner, partGroup(dragged.owner, dragged.id)),
        dragged.id,
        (part) => boxOf(dragged.owner, part),
        partAxis(dragged.owner, dragged.id),
        rightToLeft && mirrorsParts(dragged.owner),
      )
    : []
  const shown = owners.flatMap((owner) =>
    orderedContainers(draft, owner).flatMap((group) => group.filter((part) => boxOf(owner, part)).map((part) => ({ owner, part, box: boxOf(owner, part)! }))),
  )
  return (
    <>
      {zones.map((zone) => (
        <DropZone
          key={zone.key}
          id={zone.key}
          box={zone.box}
          accepts={(data) => data.kind === 'arrange' && data.scope === 'part'}
          drop={() => placePart(dragged!.owner, dragged!.id, partName(dragged!.owner, dragged!.id), zone.at)}
        />
      ))}
      {shown.map((handle) => (
        <PartHandle key={`${handle.owner}:${handle.part}`} {...handle} underDrag={drag?.kind === 'arrange'} />
      ))}
    </>
  )
}
