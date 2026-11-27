import { useSettings } from '../../app/settings'
import { useStore } from '../../app/store'
import { api } from '../../shared/api'
import { tr } from '../../shared/i18n/i18n'
import { sanitizeTheme, undoAddedTheme } from '../../shared/theme/theme'
import { ask } from '../../shared/ui/Ask'
import { askAboutLayout, joinThemes } from '../settings/themeLayoutImport'
import { nameOfFile, type DropKind } from './dropKinds'
import { notifyError } from '../../app/notifyError'

/**
 * Legato's own files dropped on the window, each opened the way its page opens it: a song list becomes a playlist
 * (found on YouTube like Add music's), a theme joins My themes and is applied at once (Undo in the message; a question
 * only when it rearranges the app), a backup replaces the library after a question. The files are untrusted: Rust checks size and shape (`import_song_list`, `import_theme`, `library_restore`).
 * A remix is `editor/remixFile`.
 */
export async function openDropped(kind: Exclude<DropKind, 'remix'>, path: string) {
  const { notify } = useStore.getState()
  const fail = (error: unknown) => void notifyError(error)
  try {
    if (kind === 'songlist') {
      await useStore.getState().importSongList(nameOfFile(path), null, path)
    } else if (kind === 'theme') {
      const theme = sanitizeTheme({ ...((await api.importTheme(path)) as object), id: undefined })
      if (!theme) throw new Error(tr('Invalid theme: all 13 colors are needed, as #RRGGBB.'))
      const accepted = await askAboutLayout(theme)
      if (!accepted) return
      // Read after the question: the settings may have moved meanwhile (Sync Mode).
      const before = useSettings.getState().settings
      const joined = joinThemes(accepted)
      if (!joined) return
      const undo = () => useSettings.getState().update(undoAddedTheme(useSettings.getState().settings, before, joined))
      const name = joined.theme.name
      notify(joined.added ? tr('Theme “{name}” added', { name }) : tr('Applied: {name}', { name }), { action: { label: tr('Undo'), run: undo } })
    } else if (await ask({ title: tr('Replace your library with this backup?'), body: tr('Your playlists, likes, history and settings become the backup’s, then Legato restarts.'), ok: tr('Restore') })) {
      await api.libraryRestore(path)
    }
  } catch (e) {
    fail(e)
  }
}
