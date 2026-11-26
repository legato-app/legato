import { useContext } from 'react'
import { arrangeParts, pagePartIds, type PartedPage } from '../theme/layout'
import { PageLayout } from './pageLayout'

/** The blocks under a page's header to draw, in order, as the theme arranges them. */
export function usePageParts(page: PartedPage): string[] {
  return arrangeParts(useContext(PageLayout)[page], pagePartIds(page))
}
