import type { Track } from '../../shared/api'
import { msg } from '../../shared/i18n/i18n'

/** How a track plays here: external music through YouTube only. server = your music server, by the native engine like
 * a local file. preview = Apple 30 s clip, the last resort. */
export type Via = 'local' | 'server' | 'youtube' | 'preview'

export const viaLabel: Record<Via, string> = { local: msg('Local file'), server: msg('Your music server'), youtube: 'YouTube', preview: msg('Apple Music preview') }

/** Ways this track can play, best first: local file, your server, YouTube (in app), then preview. */
export const vias = (t: Pick<Track, 'ids'>): Via[] => [t.ids.local && 'local', t.ids.server && 'server', t.ids.youtube && 'youtube', t.ids.apple && 'preview'].filter((v): v is Via => !!v)

/** Plays in full (not just a preview). */
export const isFull = (t: Pick<Track, 'ids'>) => !!(t.ids.local || t.ids.server || t.ids.youtube)

/** No way to play it in full yet, but YouTube may have it (Against Liner 13): a library song with an artist, not found
 * before. The player looks it up as it comes up to play. */
export const toFind = (t: Pick<Track, 'ids' | 'artist'> & { id: number }, notFound: ReadonlySet<number>) => t.id > 0 && !isFull(t) && !!t.artist.trim() && !notFound.has(t.id)

/** Engine paths of server songs (`music_player::http::PREFIX`): no URL, no auth, Rust builds the requests. */
export const SERVER_PATH = 'server:'

/** Played by the native engine: a local file or a server song. */
export const isNative = (via: Via | undefined) => via === 'local' || via === 'server'

/** What the native engine plays for `via`: the file, or the server song's engine path. */
export const nativePath = (t: Pick<Track, 'ids'>, via: Via): string | undefined => (via === 'local' ? t.ids.local : via === 'server' && t.ids.server ? SERVER_PATH + t.ids.server : undefined)

/** The engine's words for a server that's off or refusing (`servers.rs`, `http.rs`): the run stopped there, so the
 * queue stops too (Play tries again) instead of trying each next song. A song the server lacks isn't one. */
export const serverDown = (error: string) => /^Your music server( doesn['’]t answer| refused the sign-in| isn['’]t signed in| doesn['’]t take|['’]s certificate)|^That address isn['’]t a Subsonic server/.test(error)

/** A status path's way in. */
export const viaOfPath = (path: string): Via => (path.startsWith(SERVER_PATH) ? 'server' : 'local')
