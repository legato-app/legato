import { useMemo } from 'react'
import { create } from 'zustand'
import { tr } from '../shared/i18n/i18n'
import { useNarrow, usePhone } from '../shared/phone'
import { phoneApp } from '../shared/platform'
import { layoutOn, resolveLayout, type Placement } from '../shared/theme/layout'
import { useSettings } from './settings'
import { useStore } from './store'

/** A layout that broke while being drawn: the app's own for the rest of this run. */
export const useLayoutFailure = create(() => ({ failed: false }))

export function dropLayout() {
  useLayoutFailure.setState({ failed: true })
  useStore.getState().notify(tr('This theme’s layout didn’t work: the default layout is back'), { kind: 'error' })
}

/** The arrangement on screen: the theme's, unless themes may not arrange the app or it broke; a phone keeps its own. */
export function useShellLayout(): Placement {
  const allowed = useSettings((s) => s.settings.themeLayouts)
  const layout = useSettings((s) => s.current().layout)
  const failed = useLayoutFailure((s) => s.failed)
  const phone = usePhone()
  return useMemo(() => resolveLayout(allowed && !failed ? layout : undefined, phone), [allowed, failed, layout, phone])
}

/** Is the shell drawn another way than the app's own right now (for a menu, built outside React)? */
export function shellLayoutOn() {
  const { settings, current } = useSettings.getState()
  return !phoneApp && !useLayoutFailure.getState().failed && layoutOn(settings.themeLayouts, current().layout)
}

/** No right panel to open (a narrow window, a theme without it): what it holds is Now Playing's and the floating card's. */
export function useSidePanelAway() {
  const narrow = useNarrow()
  const hidden = useShellLayout().hidden.includes('sidePanel')
  return narrow || hidden
}
