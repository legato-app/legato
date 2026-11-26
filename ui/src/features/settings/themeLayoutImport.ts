import { useSettings } from '../../app/settings'
import { tr } from '../../shared/i18n/i18n'
import { phoneApp } from '../../shared/platform'
import { layoutSummary, withoutLayout } from '../../shared/theme/layout'
import type { Theme } from '../../shared/theme/theme'
import { askChoice } from '../../shared/ui/Ask'

/**
 * A theme about to join, whatever door it came through: when it rearranges the app and themes may, the user picks.
 * The theme to add (its layout left out for "Colors only"); null: not at all. A phone asks nothing and keeps the
 * layout: it never applies there, a PC gets it through Sync Mode like any synced theme.
 */
export async function askAboutLayout(theme: Theme): Promise<Theme | null> {
  const changes = !phoneApp && useSettings.getState().settings.themeLayouts ? layoutSummary(theme.layout) : []
  if (!changes.length) return theme
  const body = [tr('Besides its colors, it moves or hides parts of the app:'), ...changes.map((change) => `• ${change}`), '', tr('You can go back at any time: right-click › Default layout, or Settings (Ctrl+,) › Appearance › Let themes arrange the app.')]
  const answer = await askChoice({ title: tr('This theme rearranges Legato'), body: body.join('\n'), ok: tr('Use its layout'), other: tr('Colors only') })
  if (answer === null) return null
  return answer === 'ok' ? theme : withoutLayout(theme)
}
