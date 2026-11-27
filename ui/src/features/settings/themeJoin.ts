import { notifyError } from '../../app/notifyError'
import { useSettings } from '../../app/settings'
import { tr } from '../../shared/i18n/i18n'
import { withAddedTheme, type JoinedTheme, type JoinOptions, type Theme } from '../../shared/theme/theme'

/** `withAddedTheme` written into the settings, whatever door the theme came through; a full list is said. Null: nothing changed. */
export function joinThemes(theme: Theme, options?: JoinOptions): JoinedTheme | null {
  const { settings, update } = useSettings.getState()
  const joined = withAddedTheme(settings, theme, options)
  if (!joined) void notifyError(new Error(tr('24 themes at most: remove one first.')))
  else update(joined.changes)
  return joined
}
