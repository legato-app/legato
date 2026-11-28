import { DotsSixVertical } from '@phosphor-icons/react'
import { useEffect } from 'react'
import { useArrangeDraft } from '../../app/arrangeDraft'
import { useStore } from '../../app/store'
import { isRtl, useLang } from '../../shared/i18n/i18n'
import { canHideSurface, neverHides, type Direction } from '../../shared/theme/arrange'
import { placesOf, type Surface } from '../../shared/theme/layout'
import { useDrag } from '../../shared/ui/drag'
import { usePlayer } from '../player/store'
import { usePlugins } from '../plugins/host'
import { ArrangeHeader } from './ArrangeHeader'
import { ArrangeParts } from './ArrangeParts'
import { useDrawnBoxes } from './boxes'
import { DropZone, handleProps, PILL } from './handles'
import { surfaceName } from './names'
import { hideSurface, nudgeSurface, placeSurface, useArrange } from './session'
import { headerHasHandle, ownersShown, surfaceHasHandle } from './shown'
import { dropZones, type Box } from './zones'

/** A bar that holds parts keeps its middle for them: its handle sits on its edge towards the page. */
function handleTop(surface: Surface, box: Box) {
  const middle = box.top + box.height / 2
  if (surface !== 'topbar' && surface !== 'playerBar') return middle
  return middle < window.innerHeight / 2 ? box.top + box.height : box.top
}

/** A surface's handle, named. `underDrag`: something is dragged, the handles let the pointer through to the drop zones. */
function SurfaceHandle({ surface, name, box, underDrag }: { surface: Surface; name: string; box: Box; underDrag: boolean }) {
  const columns: Direction[] = placesOf(surface).includes('left') ? ['left', 'right'] : []
  const bars: Direction[] = placesOf(surface).includes('bottom') ? ['up', 'down'] : []
  const props = handleProps({
    id: surface,
    name,
    drag: { kind: 'arrange', scope: 'surface', id: surface },
    directions: [...columns, ...bars],
    move: (direction) => nudgeSurface(surface, name, direction),
    hiding: neverHides(surface)
      ? undefined
      : {
          allowed: () => canHideSurface(useArrangeDraft.getState().draft?.hidden ?? [], surface),
          hide: () => hideSurface(surface, name),
          isHidden: () => !!useArrangeDraft.getState().draft?.hidden.includes(surface),
        },
  })
  return (
    <button
      {...props}
      style={{ left: box.left + box.width / 2, top: handleTop(surface, box) }}
      className={`fixed z-40 -translate-x-1/2 -translate-y-1/2 ${PILL} ${underDrag ? 'pointer-events-none opacity-50' : ''}`}
    >
      <DotsSixVertical size={14} weight="bold" /> {name}
    </button>
  )
}

/** The handles over the app (the surfaces', the parts', the page header's), the drop zones while one is dragged, and
 *  each move said to screen readers. */
export function ArrangeSurfaces() {
  const draft = useArrangeDraft((state) => state.draft)!
  const said = useArrange((state) => state.said)
  const saidCount = useArrange((state) => state.saidCount)
  const plugins = usePlugins((state) => state.list)
  const boxes = useDrawnBoxes(draft)
  // A step passes the parts with nothing to show, and they are not counted when a move is said.
  useEffect(() => {
    if (boxes.filled.length) useArrange.setState({ filled: boxes.filled })
  }, [boxes])
  const drag = useDrag((state) => state.data)
  const dragged = drag?.kind === 'arrange' && drag.scope === 'surface' ? drag.id : null
  const rightToLeft = useLang((state) => isRtl(state.lang))
  const view = useStore((state) => state.view.name)
  const nowPlaying = usePlayer((state) => state.full)
  const screen = { view, nowPlaying, hidden: draft.hidden }
  const name = (surface: Surface) => surfaceName(surface, plugins)
  const zones = dragged ? dropZones(draft, dragged, boxes.surfaces, { width: window.innerWidth, height: window.innerHeight }, rightToLeft) : []
  return (
    <>
      <ArrangeParts draft={draft} owners={ownersShown(screen)} boxes={boxes.parts} />
      {headerHasHandle(screen) && boxes.header && <ArrangeHeader draft={draft} header={boxes.header} />}
      {zones.map((zone) => (
        <DropZone
          key={zone.key}
          id={zone.key}
          box={zone.box}
          accepts={(data) => data.kind === 'arrange' && data.scope === 'surface'}
          drop={() => placeSurface(dragged!, name(dragged!), zone.region, zone.at)}
        />
      ))}
      {(Object.entries(boxes.surfaces) as [Surface, Box][])
        .filter(([surface]) => surfaceHasHandle(surface, screen))
        .map(([surface, box]) => (
          <SurfaceHandle key={surface} surface={surface} name={name(surface)} box={box} underDrag={drag?.kind === 'arrange'} />
        ))}
      <p role="status" aria-live="polite" className="sr-only">
        {/* A new node each time: the same words are read again. */}
        <span key={saidCount}>{said}</span>
      </p>
    </>
  )
}
