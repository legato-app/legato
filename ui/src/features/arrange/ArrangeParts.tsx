import { EyeSlash } from '@phosphor-icons/react'
import { useArrangeDraft } from '../../app/arrangeDraft'
import { isRtl, tr, useLang } from '../../shared/i18n/i18n'
import { canHidePart, mirrorsParts, orderedParts, partAxis, partGroup } from '../../shared/theme/arrange'
import { PART_GROUPS, type PartedSurface, type Placement } from '../../shared/theme/layout'
import { useDrag } from '../../shared/ui/drag'
import type { DrawnBoxes } from './boxes'
import { DropZone, handleProps, hideAndFollow } from './handles'
import { partName } from './names'
import { hidePart, nudgePart, placePart } from './session'
import { partZones, type Box } from './zones'

/** Half the eye's size: it stays whole inside the window. */
const EYE_REACH = 10

interface PartProps {
  surface: PartedSurface
  part: string
  box: Box
  /** The parts of its container that have a box. */
  onScreen: string[]
  underDrag: boolean
}

/** A part's handle covers it, outlined; the eye on its corner hides the ones that can be. */
function PartHandle({ surface, part, box, onScreen, underDrag }: PartProps) {
  const name = partName(surface, part)
  const id = `part:${surface}:${part}`
  const hiding = canHidePart(surface, part)
    ? { allowed: () => true, hide: () => hidePart(surface, part, name), isHidden: () => !!useArrangeDraft.getState().draft?.parts[surface]?.hidden?.includes(part) }
    : undefined
  const through = underDrag ? 'pointer-events-none' : ''
  const props = handleProps({
    id,
    name,
    drag: { kind: 'arrange', scope: 'part', surface, id: part },
    directions: partAxis(surface, part) === 'down' ? ['up', 'down'] : ['left', 'right'],
    move: (direction) => nudgePart(surface, part, name, direction, onScreen),
    hiding,
  })
  return (
    <>
      <button {...props} style={box} className={`fixed z-35 cursor-grab touch-none rounded-md border border-dashed border-ink-3 hover:bg-ink/10 focus-visible:bg-ink/10 ${through}`} />
      {hiding && (
        <button
          type="button"
          aria-label={tr('Hide {part}', { part: name })}
          title={tr('Hide {part}', { part: name })}
          onClick={() => hideAndFollow(id, hiding)}
          style={{ left: Math.min(box.left + box.width, window.innerWidth - EYE_REACH), top: Math.max(box.top, EYE_REACH) }}
          className={`fixed z-36 flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-ink text-bg shadow-[0_2px_8px_var(--shadow)] ${through}`}
        >
          <EyeSlash size={12} weight="bold" />
        </button>
      )}
    </>
  )
}

/** The bars' parts: their handles over them, and the drop zones while one is dragged. */
export function ArrangeParts({ draft, boxes }: { draft: Placement; boxes: DrawnBoxes['parts'] }) {
  const drag = useDrag((state) => state.data)
  const rightToLeft = useLang((state) => isRtl(state.lang))
  const dragged = drag?.kind === 'arrange' && drag.scope === 'part' ? drag : null
  const boxOf = (surface: PartedSurface, part: string): Box | undefined => boxes[`${surface}:${part}`]
  const zones = dragged
    ? partZones(
        orderedParts(draft, dragged.surface, partGroup(dragged.surface, dragged.id)),
        dragged.id,
        (part) => boxOf(dragged.surface, part),
        partAxis(dragged.surface, dragged.id),
        rightToLeft && mirrorsParts(dragged.surface),
      )
    : []
  // A hidden bar's parts show nowhere. Containers first: the handles of what they hold are drawn over theirs.
  const shown = (Object.keys(PART_GROUPS) as PartedSurface[])
    .filter((surface) => !draft.hidden.includes(surface))
    .flatMap((surface) =>
      PART_GROUPS[surface].flatMap((group: readonly string[]) => {
        const onScreen = orderedParts(draft, surface, group).filter((part) => boxOf(surface, part))
        return onScreen.map((part) => ({ surface, part, box: boxOf(surface, part)!, onScreen }))
      }),
    )
  return (
    <>
      {zones.map((zone) => (
        <DropZone
          key={zone.key}
          id={zone.key}
          box={zone.box}
          accepts={(data) => data.kind === 'arrange' && data.scope === 'part'}
          drop={() => placePart(dragged!.surface, dragged!.id, partName(dragged!.surface, dragged!.id), zone.at)}
        />
      ))}
      {shown.map((handle) => (
        <PartHandle key={`${handle.surface}:${handle.part}`} {...handle} underDrag={drag?.kind === 'arrange'} />
      ))}
    </>
  )
}
