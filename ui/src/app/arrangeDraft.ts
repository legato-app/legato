/**
 * The shell's side of arranging the app by hand: the arrangement being edited, drawn in place of the theme's, and the
 * way into the mode (`features/arrange`, loaded on first use).
 */
import { create } from 'zustand'
import { tr } from '../shared/i18n/i18n'
import { isPhone } from '../shared/phone'
import { phoneApp } from '../shared/platform'
import type { Placement } from '../shared/theme/layout'
import { notifyError } from './notifyError'
import { useStore } from './store'

/** `draft` null: not arranging. Only `features/arrange` writes it; a layout that breaks ends it (`dropLayout`). */
export const useArrangeDraft = create<{ draft: Placement | null }>(() => ({ draft: null }))

/** Opens the arranging mode. A phone keeps its own arrangement, and a window as narrow as one draws it too. */
export function startArranging() {
  if (phoneApp) return
  if (isPhone()) return void useStore.getState().notify(tr('Arranging needs a wider window'), { kind: 'info' })
  void import('../features/arrange/session').then((session) => session.beginArranging()).catch(notifyError)
}
