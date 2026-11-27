import { type ComponentType, createElement, lazy } from 'react'
import { isCutPage } from '../shared/liteCuts'

/** A page Lite cuts (shared/liteCuts.ts) draws nothing and its chunk is never asked for. */
function unlessCut<T>(name: string, fetch: () => Promise<T>): () => Promise<T> {
  return isCutPage(name) ? () => Promise.resolve({ default: () => null } as T) : fetch
}

// Pages that load on their first visit, not at launch (the shell, sidebar and player bar stay in the first chunk); Now
// Playing, the lyrics panel and the dialogs too.
// `preloadPages` pulls them in when idle, so a click rarely waits. Home is asked for at once: it is the usual first screen.
const load = {
  home: () => import('../features/home/HomeView').then((m) => ({ default: m.HomeView })),
  add: () => import('../features/add/AddView').then((m) => ({ default: m.AddView })),
  search: () => import('../features/search/SearchView').then((m) => ({ default: m.SearchView })),
  mixes: () => import('../features/mixes/MixesView').then((m) => ({ default: m.MixesView })),
  mix: () => import('../features/mixes/MixesView').then((m) => ({ default: m.MixView })),
  podcasts: unlessCut('podcasts', () => import('../features/podcasts/PodcastsView').then((m) => ({ default: m.PodcastsView }))),
  books: unlessCut('books', () => import('../features/books/BooksView').then((m) => ({ default: m.BooksView }))),
  tv: unlessCut('tv', () => import('../features/livingRoom/TvHome').then((m) => ({ default: m.TvHome }))),
  keyboard: unlessCut('keyboard', () => import('../features/livingRoom/OnScreenKeyboard').then((m) => ({ default: m.OnScreenKeyboard }))),
  radio: () => import('../features/radio/RadioView').then((m) => ({ default: m.RadioView })),
  stats: () => import('../features/stats/StatsView').then((m) => ({ default: m.StatsView })),
  history: () => import('../features/history/HistoryView').then((m) => ({ default: m.HistoryView })),
  smart: () => import('../features/smart/SmartView').then((m) => ({ default: m.SmartView })),
  songs: () => import('../features/library/LibraryView').then((m) => ({ default: m.SongsView })),
  albums: () => import('../features/library/LibraryView').then((m) => ({ default: m.AlbumsView })),
  artists: () => import('../features/library/LibraryView').then((m) => ({ default: m.ArtistsView })),
  playlist: () => import('../features/library/LibraryView').then((m) => ({ default: m.PlaylistView })),
  album: () => import('../features/library/AlbumArtist').then((m) => ({ default: m.AlbumView })),
  artist: () => import('../features/library/AlbumArtist').then((m) => ({ default: m.ArtistView })),
  notFound: () => import('../features/library/NotFoundView').then((m) => ({ default: m.NotFoundView })),
  health: () => import('../features/library/HealthView').then((m) => ({ default: m.HealthView })),
  settings: () => import('../features/settings/SettingsView').then((m) => ({ default: m.SettingsView })),
  addons: unlessCut('addons', () => import('../features/addons/AddonsView').then((m) => ({ default: m.AddonsView }))),
  editor: unlessCut('editor', () => import('../features/editor/EditorPanel').then((m) => ({ default: m.EditorPanel }))),
  shelf: () => import('../features/home/HomeView').then((m) => ({ default: m.YouTubeShelf })),
  karaoke: unlessCut('karaoke', () => import('../features/player/Karaoke').then((m) => ({ default: m.Karaoke }))),
  vizScreen: unlessCut('vizScreen', () => import('../features/player/VizScreen').then((m) => ({ default: m.VizScreen }))),
  coverScreen: () => import('../features/player/CoverScreen').then((m) => ({ default: m.CoverScreen })),
  pipScreen: () => import('../features/player/PipScreen').then((m) => ({ default: m.PipScreen })),
  pluginColumn: unlessCut('pluginColumn', () => import('../features/plugins/PluginColumn').then((m) => ({ default: m.PluginColumn }))),
  share: () => import('../features/share/ShareDialog').then((m) => ({ default: m.ShareDialog })),
  room: unlessCut('room', () => import('../features/rooms/RoomDialog').then((m) => ({ default: m.RoomDialog }))),
  welcome: () => import('../features/welcome/Welcome').then((m) => ({ default: m.Welcome })),
  nowPlaying: () => import('../features/player/NowPlaying').then((m) => ({ default: m.NowPlaying })),
  lyrics: () => import('../features/player/LyricsPanel').then((m) => ({ default: m.LyricsPanel })),
  blindTest: unlessCut('blindTest', () => import('../features/blind/BlindTest').then((m) => ({ default: m.BlindTest }))),
  importDialog: () => import('../features/share/ImportDialog').then((m) => ({ default: m.ImportDialog })),
  importScreen: () => import('../features/add/ImportScreen').then((m) => ({ default: m.ImportScreen })),
  connectWizard: () => import('../features/sources/ConnectWizard').then((m) => ({ default: m.ConnectWizard })),
  duplicates: () => import('../features/library/DuplicatesDialog').then((m) => ({ default: m.DuplicatesDialog })),
  columnBrowser: () => import('../features/library/ColumnBrowser').then((m) => ({ default: m.ColumnBrowser })),
  sharePanel: () => import('../features/share/SharePanel').then((m) => ({ default: m.SharePanel })),
  cast: () => import('../features/player/CastDialog').then((m) => ({ default: m.CastDialog })),
  credits: () => import('../features/library/CreditsDialog').then((m) => ({ default: m.CreditsDialog })),
  editInfo: () => import('../features/library/EditInfo').then((m) => ({ default: m.EditInfo })),
}

type Load<P> = () => Promise<{ default: ComponentType<P> }>

// React.lazy keeps a failed load for good. Each page sits behind a stable component that swaps in a new lazy when the last
// one failed: the next draw of the page (a visit, PageBoundary's Try again) asks for the chunk anew.
function page<P extends object>(fetch: Load<P>): ComponentType<P> {
  let broken = false
  const make = () =>
    lazy(() =>
      fetch().catch((e: unknown) => {
        broken = true
        throw e
      }),
    )
  let Inner = make()
  return (props: P) => {
    if (broken) {
      broken = false
      Inner = make()
    }
    return createElement(Inner as ComponentType<P>, props)
  }
}

export const HomeView = page(load.home)
export const AddView = page(load.add)
export const SearchView = page(load.search)
export const MixesView = page(load.mixes)
export const RadioView = page(load.radio)
export const PodcastsView = page(load.podcasts)
export const BooksView = page(load.books)
export const TvHome = page(load.tv)
export const OnScreenKeyboard = page(load.keyboard)
export const MixView = page(load.mix)
export const StatsView = page(load.stats)
export const HistoryView = page(load.history)
export const SmartView = page(load.smart)
export const SongsView = page(load.songs)
export const AlbumsView = page(load.albums)
export const ArtistsView = page(load.artists)
export const PlaylistView = page(load.playlist)
export const AlbumView = page(load.album)
export const ArtistView = page(load.artist)
export const NotFoundView = page(load.notFound)
export const HealthView = page(load.health)
export const SettingsView = page(load.settings)
export const AddonsView = page(load.addons)
export const EditorPanel = page(load.editor)
export const YouTubeShelf = page(load.shelf)
export const Karaoke = page(load.karaoke)
export const VizScreen = page(load.vizScreen)
export const CoverScreen = page(load.coverScreen)
export const PipScreen = page(load.pipScreen)
export const PluginColumn = page(load.pluginColumn)
export const ShareDialog = page(load.share)
export const RoomDialog = page(load.room)
export const Welcome = page(load.welcome)
export const NowPlaying = page(load.nowPlaying)
export const LyricsPanel = page(load.lyrics)
export const ImportDialog = page(load.importDialog)
export const BlindTest = page(load.blindTest)
export const ImportScreen = page(load.importScreen)
export const ConnectWizard = page(load.connectWizard)
export const DuplicatesDialog = page(load.duplicates)
export const EditInfo = page(load.editInfo)
export const CreditsDialog = page(load.credits)
export const CastDialog = page(load.cast)
export const ColumnBrowser = page(load.columnBrowser)
export const SharePanel = page(load.sharePanel)

/** Starts Home's download now (before the library is in), the likeliest first screen. */
export const preloadHome = () => void load.home()
/** Picture-in-picture: drawn before the window shrinks (pipMode.ts). */
export const preloadPip = () => load.pipScreen()

/** The other pages, one per idle slice once the app is up. A failed fetch is retried by the page itself on its visit. */
export function preloadPages() {
  const next = [load.songs, load.nowPlaying, load.lyrics, load.album, load.search, load.add, load.mixes, load.stats, load.smart, load.editor, load.settings, load.addons, load.karaoke, load.vizScreen, load.coverScreen]
  const idle = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 200))
  const step = () => {
    const f = next.shift()
    if (!f) return
    void f().catch(() => {})
    idle(step)
  }
  idle(step)
}
