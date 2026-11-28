import type { ReactNode } from 'react'
import type { PartedSurface } from '../shared/theme/layout'
import { useArrangeDraft } from './arrangeDraft'

/**
 * A bar's part, findable while the app is arranged: a mark before it and one after (`features/arrange/boxes.ts`). Only
 * then, so a theme's CSS selects the same elements as ever; the part itself is not mounted again.
 */
export function ArrangePart({ surface, part, children }: { surface: PartedSurface; part: string; children: ReactNode }) {
  const arranging = useArrangeDraft((state) => state.draft !== null)
  return (
    <>
      {arranging && <template data-part={`${surface}:${part}`} />}
      {children}
      {arranging && <template data-part-end="" />}
    </>
  )
}
