import { useMemo } from 'react'
import { useNarrow, usePhone } from '../shared/phone'
import { resolveLayout, type Placement } from '../shared/theme/layout'
import { useSettings } from './settings'

/** The arrangement on screen: the theme's, unless themes may not arrange the app; a phone keeps its own. */
export function useShellLayout(): Placement {
  const allowed = useSettings((s) => s.settings.themeLayouts)
  const layout = useSettings((s) => s.current().layout)
  const phone = usePhone()
  return useMemo(() => resolveLayout(allowed ? layout : undefined, phone), [allowed, layout, phone])
}

/** No right panel to open (a narrow window, a theme without it): what it holds is Now Playing's and the floating card's. */
export function useSidePanelAway() {
  const narrow = useNarrow()
  const hidden = useShellLayout().hidden.includes('sidePanel')
  return narrow || hidden
}
