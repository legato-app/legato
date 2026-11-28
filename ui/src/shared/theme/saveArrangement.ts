/**
 * An arrangement made by hand, written into a theme of the user's own: the one edited when it is theirs, a copy of a
 * preset (or of a theme whose layout a newer app wrote, kept as it is) otherwise. Pure.
 */
import { LAYOUT_API, resolveLayout, withoutLayout, type Placement } from './layout'
import { layoutFromPlacement } from './arrange'
import { duplicateTheme, undoAddedTheme, withAddedTheme, type JoinedTheme, type Settings, type Theme } from './theme'

export type SavedArrangement =
  /** Nothing moved: nothing to write. */
  | { kind: 'unchanged' }
  /** A copy was needed and My themes is full. */
  | { kind: 'full' }
  | { kind: 'saved'; theme: Theme; changes: Partial<Settings>; undo: (now: Settings) => Partial<Settings> }

/** The theme's layout as the format writes it: two arrangements are the same when this text is. */
const written = (placement: Placement) => JSON.stringify(layoutFromPlacement(placement) ?? null)

/**
 * `draft` saved for `edited`, the theme picked while arranging (a preset under the name to give its copy). `copyName`
 * names a copy. Saving turns `themeLayouts` back on: the arrangement is there to be seen.
 */
export function saveArrangement(settings: Settings, edited: Theme, draft: Placement, copyName: string): SavedArrangement {
  if (written(draft) === written(resolveLayout(edited.layout))) return { kind: 'unchanged' }
  const layout = layoutFromPlacement(draft)
  const own = settings.customThemes.find((theme) => theme.id === edited.id)
  if (own && (own.layout?.v ?? LAYOUT_API) <= LAYOUT_API) {
    const theme = layout ? { ...own, layout } : withoutLayout(own)
    const replace = (themes: Theme[], by: Theme) => themes.map((other) => (other.id === own.id ? by : other))
    return {
      kind: 'saved',
      theme,
      changes: { customThemes: replace(settings.customThemes, theme), themeLayouts: true },
      // The list as it is by then (Sync Mode may have changed it), this theme as it was.
      undo: (now) => ({ customThemes: replace(now.customThemes, own), themeLayouts: settings.themeLayouts }),
    }
  }
  const copy = duplicateTheme(edited, copyName, { layout })
  const joined: JoinedTheme | null = copy && withAddedTheme(settings, copy, { look: false, dedupe: false })
  if (!joined) return { kind: 'full' }
  const added = { ...joined, changes: { ...joined.changes, themeLayouts: true } }
  return { kind: 'saved', theme: added.theme, changes: added.changes, undo: (now) => undoAddedTheme(now, settings, added) }
}
