import type { Merged } from '../../shared/api'
import { tr, trn } from '../../shared/i18n/i18n'

/** What a merge changed, counted in a few words; empty = nothing new. */
export function mergedChanges(m: Merged): string {
  return [
    m.playlists && trn(m.playlists, '{n} playlist', '{n} playlists'),
    m.songs && trn(m.songs, '{n} song', '{n} songs'),
    m.deleted + m.removed && trn(m.deleted + m.removed, '{n} deletion', '{n} deletions'),
    m.plays && trn(m.plays, '{n} listen', '{n} listens'),
    m.edits && trn(m.edits, '{n} Live Editor change', '{n} Live Editor changes'),
    m.settings && trn(m.settings, '{n} setting', '{n} settings'),
  ]
    .filter(Boolean)
    .join(', ')
}

/** What another device brought; null = nothing new. */
export function mergedText(m: Merged): string | null {
  const changes = mergedChanges(m)
  return changes ? tr('From your other device: {changes}', { changes }) : null
}
