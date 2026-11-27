import { useSettings } from '../../app/settings'
import { useStore } from '../../app/store'
import { api } from '../../shared/api'
import { tr } from '../../shared/i18n/i18n'
import { sanitizeTheme } from '../../shared/theme/theme'
import { ask } from '../../shared/ui/Ask'
import { askAboutLayout } from '../settings/themeLayoutImport'
import { nameOfFile, type DropKind } from './dropKinds'
import { notifyError } from '../../app/notifyError'

/**
 * Legato's own files dropped on the window, each opened the way its page opens it: a song list becomes a playlist
 * (found on YouTube like Add music's), a theme joins the themes and is picked, a backup replaces the library after a
 * question. The files are untrusted: Rust checks size and shape (`import_song_list`, `import_theme`, `library_restore`).
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
      if (useSettings.getState().settings.customThemes.length >= 24) throw new Error(tr('24 themes at most: remove one first.'))
      // A file from outside (its CSS can change the whole window): applied once the user says so.
      if (!(await ask({ title: tr('Use the theme “{name}”?', { name: theme.name }), body: tr('It joins your themes and is applied now; Settings › Appearance › Theme takes you back.'), ok: tr('Use it') }))) return
      const accepted = await askAboutLayout(theme)
      if (!accepted) return
      // Read after the questions: the list may have moved meanwhile (Sync Mode).
      const { settings, update } = useSettings.getState()
      update({ customThemes: [...settings.customThemes, accepted], theme: accepted.id })
      notify(tr('Theme “{name}” added', { name: accepted.name }))
    } else if (await ask({ title: tr('Replace your library with this backup?'), body: tr('Your playlists, likes, history and settings become the backup’s, then Legato restarts.'), ok: tr('Restore') })) {
      await api.libraryRestore(path)
    }
  } catch (e) {
    fail(e)
  }
}
