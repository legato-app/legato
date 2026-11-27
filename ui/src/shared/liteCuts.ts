// What Legato Lite leaves out (plan-v2 "A Lite build"), in one table: pages, shortcuts, settings, right-click items and
// start-up modules read it. Saved settings, shortcuts and menu layouts keep their values: Lite only stops showing and
// running what is listed here, so a full app's data comes back untouched. Pure: no `window`, imported by tests.
import type { ActionId } from '../app/keys'
import { LITE } from './edition'
import type { MenuKind } from './ui/menuShape'

export interface Cut {
  /** Keys of `app/pages.ts`' loaders (a view's name where it is a page). */
  pages?: string[]
  shortcuts?: ActionId[]
  /** Ids of `features/settings/catalog.ts`: rows and groups. */
  settings?: string[]
  /** Item ids of `ui/menuShape.ts`, cut from every kind of menu. */
  menuItems?: string[]
  /** Whole kinds of menu, left out of Settings › Right-click menus. */
  menuKinds?: MenuKind[]
  /** Names in `app/deferred.ts`' start list. */
  starters?: string[]
}

export const LITE_CUTS = {
  // The effects go with the editor: Lite plays songs without their saved edits. The per-output equalizer and levelling stay.
  liveEditor: { pages: ['editor'], menuItems: ['liveEditor', 'shareMix', 'copyMixLink', 'practiceSpeed'] },
  // The loudness meter is one of its looks.
  visualizer: {
    pages: ['vizScreen'],
    shortcuts: ['vizFull'],
    settings: ['Moving cover', 'Visualizer', 'Visualizer style', 'Meter face', 'Spectrogram colors', 'Visualizer preset', 'Preset colors', 'Visualizer weighting', 'Visualizer color', 'Visualizer gradient', 'Visualizer bands', 'Visualizer reflection', 'Visualizer behind Now Playing', 'Visualizer in the mini player'],
    menuKinds: ['visualizer'],
  },
  // One YouTube embed at a time: no second one to fade into or to cue the next song in (store.ts `cueNext`), and no
  // fade between songs for local files either (fade.ts `effectiveFade`).
  crossfade: { settings: ['Fade between songs', 'Sweet fades', 'No fade within an album', 'Advanced fade', 'Fade in after a skip', 'Fade on pause and play'], starters: ['Sweet fades'] },
  musicDetector: { settings: ['Music Detector', 'Ask this PC’s media players first', 'Name songs with AcoustID (free)'] },
  discord: { settings: ['Sharing', 'Discord sign-in'], starters: ['Discord plugin'] },
  // Stream Deck talks to the phone remote's server: gone with these two.
  streamingOverlay: { settings: ['Streaming overlay', 'Visualizer on the overlay'], starters: ['Streaming overlay'] },
  phoneRemote: { settings: ['Phone remote'], starters: ['Phone remote'] },
  listeningRooms: { pages: ['room'], menuItems: ['room'], starters: ['Listening rooms'] },
  plugins: { pages: ['addons', 'pluginColumn'], starters: ['Plugins'] },
  blindTest: { pages: ['blindTest'], menuItems: ['blindTest'], settings: ['Blind test'] },
  karaoke: { pages: ['karaoke'], shortcuts: ['karaoke'], menuItems: ['karaoke'] },
  livingRoom: { pages: ['tv', 'keyboard'], menuItems: ['tvHome'], settings: ['Living-room mode', 'TV home'], starters: ['Living room', 'TV home'] },
  podcasts: { pages: ['podcasts'], menuItems: ['podcasts'], settings: ['Podcasts', 'Check podcasts'], starters: ['Podcast check'] },
  audiobooks: { pages: ['books'], menuItems: ['audiobooks'], settings: ['Audiobooks'] },
} satisfies Record<string, Cut>

export type Feature = keyof typeof LITE_CUTS

/** False in Lite for a cut feature: for the buttons and rules no table above reaches. */
export const offered = (feature: Feature) => !(LITE && feature in LITE_CUTS)

const cuts: Cut[] = LITE ? Object.values(LITE_CUTS) : []
const cutBy = (list: (cut: Cut) => readonly string[] | undefined) => {
  const names = new Set(cuts.flatMap((cut) => list(cut) ?? []))
  return (name: string) => names.has(name)
}

export const isCutPage = cutBy((cut) => cut.pages)
export const isCutShortcut = cutBy((cut) => cut.shortcuts)
export const isCutSetting = cutBy((cut) => cut.settings)
export const isCutMenuItem = cutBy((cut) => cut.menuItems)
export const isCutMenuKind = cutBy((cut) => cut.menuKinds)
export const isCutStarter = cutBy((cut) => cut.starters)
