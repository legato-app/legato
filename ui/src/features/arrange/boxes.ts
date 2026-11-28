/** Where the surfaces, the parts and the page's header are drawn now, measured while arranging. */
import { useEffect, useState } from 'react'
import type { Placement, Surface } from '../../shared/theme/layout'
import { boxAround, boxWithin, type Box } from './zones'

/** What is arranged moves, appears and grows as the app lives on: measured again this often. */
export const MEASURE_MS = 300

export interface DrawnBoxes {
  /** By `data-surface`; one not on screen has no box. */
  surfaces: Partial<Record<Surface, Box>>
  /** By `data-part` (`owner:part`, `app/ArrangePart`); a part with nothing to show, or scrolled away, has none. */
  parts: Record<string, Box>
  /** The page's header (`PageHeader`), and its art when it draws one. */
  header?: { box: Box; art?: Box }
}

/** An element's box; null when it takes no room. */
function boxOf(element: Element): Box | null {
  const { left, top, width, height } = element.getBoundingClientRect()
  return width > 0 && height > 0 ? { left, top, width, height } : null
}

/** What of an element's box shows: inside the page, what has scrolled out of it doesn't. */
function shownBox(element: Element, box: Box | null): Box | null {
  const page = element.closest('main')
  if (!page || !box) return box
  const clip = boxOf(page)
  return clip && boxWithin(box, clip)
}

/** The box around what stands between a part's two marks. */
function markedBox(mark: Element): Box | null {
  const boxes: Box[] = []
  for (let element = mark.nextElementSibling; element && !element.matches('[data-part-end]'); element = element.nextElementSibling) {
    const box = boxOf(element)
    if (box) boxes.push(box)
  }
  return shownBox(mark, boxAround(boxes))
}

function measureHeader(): DrawnBoxes['header'] {
  const header = document.querySelector('main [data-page-header]')
  const box = header && shownBox(header, boxOf(header))
  if (!header || !box) return undefined
  const art = header.querySelector('[data-header-art]')
  return { box, art: (art && shownBox(art, boxOf(art))) ?? undefined }
}

function measure(): DrawnBoxes {
  const drawn: DrawnBoxes = { surfaces: {}, parts: {}, header: measureHeader() }
  for (const element of document.querySelectorAll<HTMLElement>('[data-surface]')) {
    const box = boxOf(element)
    if (box) drawn.surfaces[element.dataset.surface as Surface] = box
  }
  for (const mark of document.querySelectorAll<HTMLElement>('[data-part]')) {
    // A page with several lists marks their columns in each: the first on screen has the handles.
    const part = mark.dataset.part!
    const box = !drawn.parts[part] && markedBox(mark)
    if (box) drawn.parts[part] = box
  }
  return drawn
}

export function useDrawnBoxes(draft: Placement) {
  const [boxes, setBoxes] = useState<DrawnBoxes>({ surfaces: {}, parts: {} })
  useEffect(() => {
    const read = () => {
      const measured = measure()
      // Unchanged: the same object, nothing drawn again.
      setBoxes((now) => (JSON.stringify(now) === JSON.stringify(measured) ? now : measured))
    }
    // Once the move is drawn, then now and then.
    const frame = requestAnimationFrame(read)
    const timer = setInterval(read, MEASURE_MS)
    window.addEventListener('resize', read)
    // Capture: a page scrolls inside the window.
    window.addEventListener('scroll', read, true)
    return () => {
      cancelAnimationFrame(frame)
      clearInterval(timer)
      window.removeEventListener('resize', read)
      window.removeEventListener('scroll', read, true)
    }
  }, [draft])
  return boxes
}
