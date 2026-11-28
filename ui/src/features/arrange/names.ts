/** The surfaces' names, and where one is now, as said to a screen reader. */
import { isRtl, lang, msg, tr } from '../../shared/i18n/i18n'
import { hiddenParts, mirroredSide, orderedParts, partGroup, type ArtPlace, type PartOwner } from '../../shared/theme/arrange'
import { pluginOf, type BuiltinSurface, type HeaderChoice, type Placement, type Region, type Surface } from '../../shared/theme/layout'
import { COLUMN_NAMES } from '../../shared/ui/columnNames'

const NAMES: Record<BuiltinSurface, string> = { brand: msg('Logo'), topbar: msg('Top bar'), sidebar: msg('Sidebar'), sidePanel: msg('Side panel'), playerBar: msg('Player bar') }

const WHERE: Record<Region, string> = { left: msg('{part} on the left'), right: msg('{part} on the right'), top: msg('{part} at the top'), bottom: msg('{part} at the bottom') }

export const PART_NAMES: Record<PartOwner, Record<string, string>> = {
  playerBar: {
    song: msg('Song'),
    center: msg('Middle'),
    actions: msg('Buttons'),
    transport: msg('Play controls'),
    progress: msg('Progress bar'),
    room: msg('Listening room'),
    sleep: msg('Sleep timer'),
    lyrics: msg('Lyrics'),
    upNext: msg('Up next'),
    volume: msg('Volume'),
    more: msg('More'),
    fullScreen: msg('Full screen'),
  },
  topbar: { history: msg('Back and forward'), search: msg('Search'), offline: msg('Offline'), addons: msg('Add-ons') },
  sidebar: { nav: msg('Menu'), library: msg('Library') },
  album: { tracks: msg('Songs'), more: msg('More albums') },
  artist: { mostPlayed: msg('Your most played'), topSongs: msg('Top songs'), discography: msg('Discography'), about: msg('About'), links: msg('Links'), shelves: msg('From YouTube Music') },
  songs: { toolbar: msg('Buttons'), browser: msg('Column browser'), list: msg('Songs') },
  albums: { toolbar: msg('Buttons'), list: msg('Albums') },
  artists: { toolbar: msg('Buttons'), list: msg('Artists') },
  home: { chips: msg('Filters'), sections: msg('Sections') },
  nowPlayingColumns: { cover: msg('Cover'), words: msg('Title and panels') },
  nowPlaying: { from: msg('Playing from'), title: msg('Title'), artists: msg('Artists'), album: msg('Album'), readout: msg('Source'), lyrics: msg('Lyrics'), next: msg('Up next') },
  nowPlayingControls: { room: msg('Listening room'), lyrics: msg('Lyrics'), upNext: msg('Up next'), sound: msg('Sound'), more: msg('More'), volume: msg('Volume') },
  columns: COLUMN_NAMES,
}

export const partName = (owner: PartOwner, part: string) => tr(PART_NAMES[owner][part] ?? part)

/** Where a part is: hidden, or its place among its container's parts that show: those `filled`, all by default. */
export function whereIsPart(placement: Placement, owner: PartOwner, part: string, name: string, filled: readonly string[] = partGroup(owner, part)): string {
  const hidden = hiddenParts(placement, owner)
  if (hidden.includes(part)) return tr('{part} hidden', { part: name })
  const shown = orderedParts(placement, owner, partGroup(owner, part)).filter((other) => other === part || (!hidden.includes(other) && filled.includes(other)))
  return `${name}, ${tr('{position} of {count}', { position: shown.indexOf(part) + 1, count: shown.length })}`
}

export const ART_NAMES: Record<Exclude<ArtPlace, 'none'>, string> = { start: msg('Art before the title'), end: msg('Art after the title'), top: msg('Art above the title') }
export const ACTION_NAMES: Record<NonNullable<HeaderChoice['actions']>, string> = { beside: msg('Buttons beside the title'), below: msg('Buttons below the title') }
export const LINE_NAMES = { kicker: msg('Line over the title'), sub: msg('Line under the title') }

/** What a change to the page headers' `key` left. */
export function whereIsHeader({ pages }: Placement, key: keyof HeaderChoice): string {
  const header = pages.header
  if (key === 'art') return header?.art === 'none' ? tr('{part} hidden', { part: tr('Header art') }) : tr(ART_NAMES[header?.art ?? 'start'])
  if (key === 'kicker' || key === 'sub') {
    const line = tr(LINE_NAMES[key])
    return header?.[key] === false ? tr('{part} hidden', { part: line }) : line
  }
  return header?.actions ? tr(ACTION_NAMES[header.actions]) : tr('Page header')
}

/** `plugins`: the installed ones, for a plugin's panel. */
export function surfaceName(surface: Surface, plugins: readonly { id: string; manifest?: { name: string } | null }[]): string {
  const plugin = pluginOf(surface)
  if (plugin === undefined) return tr(NAMES[surface as BuiltinSurface])
  return plugins.find((installed) => installed.id === plugin)?.manifest?.name ?? plugin
}

/** Where `surface` is: hidden, or its side, and its place there when it shares the side. */
export function whereIs(placement: Placement, surface: Surface, name: string): string {
  if (placement.hidden.includes(surface)) return tr('{part} hidden', { part: name })
  const entry = Object.entries(placement.regions).find(([, surfaces]) => surfaces.includes(surface))
  if (!entry) return name
  const [region, surfaces] = entry as [Region, Surface[]]
  const side = tr(WHERE[mirroredSide(region, isRtl(lang()))], { part: name })
  return surfaces.length > 1 ? `${side}, ${tr('{position} of {count}', { position: surfaces.indexOf(surface) + 1, count: surfaces.length })}` : side
}
