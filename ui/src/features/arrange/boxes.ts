/** Where the surfaces and the bars' parts are drawn now, measured while arranging. */
import { useEffect, useState } from 'react'
import type { Placement, Surface } from '../../shared/theme/layout'
import { boxAround, type Box } from './zones'

/** What is arranged moves, appears and grows as the app lives on: measured again this often. */
export const MEASURE_MS = 300

export interface DrawnBoxes {
  /** By `data-surface`; one not on screen has no box. */
  surfaces: Partial<Record<Surface, Box>>
  /** By `data-part` (`surface:part`, `app/ArrangePart`); a part with nothing to show has none. */
  parts: Record<string, Box>
}

/** An element's box; null when it takes no room. */
function boxOf(element: Element): Box | null {
  const { left, top, width, height } = element.getBoundingClientRect()
  return width > 0 && height > 0 ? { left, top, width, height } : null
}

/** The box around what stands between a part's two marks. */
function markedBox(mark: Element): Box | null {
  const boxes: Box[] = []
  for (let element = mark.nextElementSibling; element && !element.matches('[data-part-end]'); element = element.nextElementSibling) {
    const box = boxOf(element)
    if (box) boxes.push(box)
  }
  return boxAround(boxes)
}

function measure(): DrawnBoxes {
  const drawn: DrawnBoxes = { surfaces: {}, parts: {} }
  for (const element of document.querySelectorAll<HTMLElement>('[data-surface]')) {
    const box = boxOf(element)
    if (box) drawn.surfaces[element.dataset.surface as Surface] = box
  }
  for (const mark of document.querySelectorAll<HTMLElement>('[data-part]')) {
    const box = markedBox(mark)
    if (box) drawn.parts[mark.dataset.part!] = box
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
    return () => {
      cancelAnimationFrame(frame)
      clearInterval(timer)
      window.removeEventListener('resize', read)
    }
  }, [draft])
  return boxes
}
