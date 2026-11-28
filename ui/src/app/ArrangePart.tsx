import type { ReactNode } from 'react'
import type { PartOwner } from '../shared/theme/arrange'
import { useArrangeDraft } from './arrangeDraft'

/**
 * A part of a bar, a page or a songs list's header, findable while the app is arranged: a mark before it and one after (`features/arrange/boxes.ts`). Only
 * then, so a theme's CSS selects the same elements as ever; the part itself is not mounted again.
 */
export function ArrangePart({ owner, part, children }: { owner: PartOwner; part: string; children: ReactNode }) {
  const arranging = useArrangeDraft((state) => state.draft !== null)
  return (
    <>
      {arranging && <template data-part={`${owner}:${part}`} />}
      {children}
      {arranging && <template data-part-end="" />}
    </>
  )
}
