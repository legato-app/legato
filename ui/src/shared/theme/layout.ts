/**
 * A theme's arrangement of the app's shell. Data only, checked here: a layout grants nothing, it only moves the shell's
 * own parts. Pure: no window, no settings.
 */
import type { PluginInfo } from '../generated/PluginInfo'
import { tr } from '../i18n/i18n'

/** The layouts this app draws. Within a version only additions; a newer one is kept as it came and not applied. */
export const LAYOUT_API = 1
/** A newer version's layout is kept up to this size, in characters of JSON: themes live in the settings. */
const MAX_NEWER_LAYOUT = 8_000

/** The four sides of the page, which always keeps the middle. */
export const REGIONS = ['top', 'left', 'right', 'bottom'] as const
export type Region = (typeof REGIONS)[number]
export const SURFACES = ['brand', 'topbar', 'sidebar', 'sidePanel', 'playerBar'] as const
type BuiltinSurface = (typeof SURFACES)[number]
/** One of the app's own parts, or a plugin's panel by the plugin's id (the manifest's rules for an id). */
export type Surface = BuiltinSurface | `plugin:${string}`
const PLUGIN_SURFACE = /^plugin:(?![.-])(?!.*\.\.)[a-z0-9.-]{3,64}$/
/** Plugin panels a layout may name: each takes a column from the page. */
const MAX_PLUGIN_PANELS = 2
/** The plugin whose panel a surface is; undefined for the app's own parts. */
export const pluginOf = (surface: string): string | undefined => (surface.startsWith('plugin:') ? surface.slice('plugin:'.length) : undefined)

/** Sidebar width bounds: its chips fit at the least, the page keeps room at the most. */
export const SIDEBAR_MIN = 220
export const SIDEBAR_MAX = 420
/** The right panel's: its video stays over YouTube's 200 px at the least. */
export const SIDE_PANEL_MIN = 260
export const SIDE_PANEL_MAX = 420
const SIZE_LIMITS = { sidebar: [SIDEBAR_MIN, SIDEBAR_MAX], sidePanel: [SIDE_PANEL_MIN, SIDE_PANEL_MAX] } as const
export type SizedSurface = keyof typeof SIZE_LIMITS

/** Where each surface can go: a bar runs across, a column down. The top bar holds the window's buttons and the search's
 *  list opens under it, so it stays on top. */
const PLACES: Record<BuiltinSurface, readonly Region[]> = { brand: REGIONS, topbar: ['top'], sidebar: ['left', 'right'], sidePanel: ['left', 'right'], playerBar: ['top', 'bottom'] }
/** A plugin's panel is a column. */
export const placesOf = (surface: Surface): readonly Region[] => (pluginOf(surface) ? ['left', 'right'] : PLACES[surface as BuiltinSurface])

/** The parts a layout can reorder, per bar, one list per container in the app's order. */
export const PART_GROUPS = {
  playerBar: [['song', 'center', 'actions'], ['transport', 'progress'], ['room', 'sleep', 'lyrics', 'upNext', 'volume', 'more', 'fullScreen']],
  topbar: [['history', 'search', 'offline', 'addons']],
  sidebar: [['nav', 'library']],
} as const
export type PartedSurface = keyof typeof PART_GROUPS
/** Those it can hide: each stays reachable from the bar's More. The others only move. */
export const HIDEABLE: Record<PartedSurface, readonly string[]> = { playerBar: ['transport', 'room', 'sleep', 'lyrics', 'upNext', 'volume', 'fullScreen'], topbar: ['history', 'addons'], sidebar: ['nav'] }

export interface PartsChoice {
  order?: string[]
  hidden?: string[]
}
type Parts = Partial<Record<PartedSurface, PartsChoice>>

/** The songs list's columns after Title and Artist, in the app's order. Time stays last, by the heart. */
export const COLUMNS = ['album', 'year', 'genre', 'bpm', 'key', 'sources', 'plays', 'rating', 'added', 'duration'] as const
export type Column = (typeof COLUMNS)[number]
const MOVABLE_COLUMNS = COLUMNS.filter((column) => column !== 'duration')

/** A page header's art: before the words, after them, over them, or left out. */
const HEADER_ART = ['start', 'end', 'top', 'none'] as const
const HEADER_ACTIONS = ['beside', 'below'] as const
/** The art's size, px: a cover still reads, the title keeps its room. */
const ART_MIN = 120
const ART_MAX = 320

/** The theme file's `pages.header`; what is absent stays the page's own. */
export interface HeaderChoice {
  art?: (typeof HEADER_ART)[number]
  artSize?: number
  /** false: the small line over the title is left out. */
  kicker?: boolean
  /** false: the line under the title is left out (a legal notice stays). */
  sub?: boolean
  actions?: (typeof HEADER_ACTIONS)[number]
}
/** The blocks under a page's header a layout can order, in the app's order; a fixed one (the page's lists, and what
 *  no menu else reaches) moves but never hides. */
export const PAGE_PARTS = {
  album: [{ id: 'tracks', fixed: true }, { id: 'more' }],
  artist: [{ id: 'mostPlayed', fixed: true }, { id: 'topSongs', fixed: true }, { id: 'discography' }, { id: 'about' }, { id: 'links', fixed: true }, { id: 'shelves' }],
  songs: [{ id: 'toolbar', fixed: true }, { id: 'browser', fixed: true }, { id: 'list', fixed: true }],
  albums: [{ id: 'toolbar', fixed: true }, { id: 'list', fixed: true }],
  artists: [{ id: 'toolbar', fixed: true }, { id: 'list', fixed: true }],
  // Home's sections have their own order (the theme's `look`, then the user's).
  home: [{ id: 'chips', fixed: true }, { id: 'sections', fixed: true }],
  // Now Playing on the PC: the cover's side, the title block, the buttons right of the transport.
  nowPlayingColumns: [{ id: 'cover', fixed: true }, { id: 'words', fixed: true }],
  nowPlaying: [{ id: 'from' }, { id: 'title', fixed: true }, { id: 'artists', fixed: true }, { id: 'album' }, { id: 'readout' }, { id: 'lyrics' }, { id: 'next' }],
  nowPlayingControls: [{ id: 'room', fixed: true }, { id: 'lyrics', fixed: true }, { id: 'upNext', fixed: true }, { id: 'sound', fixed: true }, { id: 'more', fixed: true }, { id: 'volume', fixed: true }],
} as const
export type PartedPage = keyof typeof PAGE_PARTS
export const pagePartIds = (page: PartedPage): string[] => PAGE_PARTS[page].map((part) => part.id)

export interface Pages extends Partial<Record<PartedPage, PartsChoice>> {
  header?: HeaderChoice
  /** The order of every songs list's columns. */
  lists?: { columns?: string[] }
}

/** The shown columns as a theme orders them: which show stays the user's pick, Time comes last. */
export function orderColumns(order: string[] | undefined, shown: readonly Column[]): Column[] {
  // Without a theme's order, the saved one stays (an older theme's columns, a settings file written by hand).
  const movable = order ? arrangeParts({ order }, MOVABLE_COLUMNS).filter((column) => shown.includes(column)) : shown.filter((column) => column !== 'duration')
  return shown.includes('duration') ? [...movable, 'duration'] : movable
}

/** The theme file's `layout` key. */
export interface Layout {
  v: number
  regions?: Partial<Record<Region, Surface[]>>
  sizes?: Partial<Record<SizedSurface, number>>
  hidden?: Surface[]
  parts?: Parts
  pages?: Pages
}

/** What the shell draws: every surface in one region, in order. */
export interface Placement {
  regions: Record<Region, Surface[]>
  sizes: Partial<Record<SizedSurface, number>>
  hidden: Surface[]
  parts: Parts
  pages: Pages
}

/** The app's own arrangement. */
export const DEFAULT_LAYOUT: Placement = { regions: { top: ['brand', 'topbar'], left: ['sidebar'], right: ['sidePanel'], bottom: ['playerBar'] }, sizes: {}, hidden: [], parts: {}, pages: {} }

const record = (value: unknown): Record<string, unknown> | null => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null)

/** The known ids of a list, each once. */
const knownList = <Id extends string>(raw: unknown, known: readonly Id[]): Id[] => [...new Set(Array.isArray(raw) ? raw.filter((id): id is Id => known.includes(id as Id)) : [])]
const surfaceList = (raw: unknown): Surface[] => knownList(raw, SURFACES)
/** A region's list: the app's parts and plugins' panels, each once. */
const regionList = (raw: unknown): Surface[] => [...new Set(Array.isArray(raw) ? raw.filter((id): id is Surface => typeof id === 'string' && ((SURFACES as readonly string[]).includes(id) || PLUGIN_SURFACE.test(id))) : [])]

/** Known ids to order, hideable ones to hide; undefined when neither. */
function partsChoice(raw: unknown, known: readonly string[], hideable: readonly string[]): PartsChoice | undefined {
  const given = record(raw)
  const order = knownList(given?.order, known)
  const hidden = knownList(given?.hidden, hideable)
  return order.length || hidden.length ? { ...(order.length > 0 && { order }), ...(hidden.length > 0 && { hidden }) } : undefined
}

function sanitizeParts(raw: unknown): Layout['parts'] {
  const given = record(raw)
  const parts = Object.entries(PART_GROUPS).flatMap(([surface, groups]) => {
    const choice = partsChoice(given?.[surface], groups.flat(), HIDEABLE[surface as PartedSurface])
    return choice ? [[surface, choice]] : []
  })
  return parts.length ? Object.fromEntries(parts) : undefined
}

/** Each surface in the first region that names it and can hold it. */
function sanitizeRegions(raw: unknown): Layout['regions'] {
  const named = record(raw)
  const taken = new Set<Surface>()
  const regions: Partial<Record<Region, Surface[]>> = {}
  let panels = 0
  for (const region of REGIONS) {
    const surfaces = regionList(named?.[region]).filter((surface) => placesOf(surface).includes(region) && !taken.has(surface) && (!pluginOf(surface) || ++panels <= MAX_PLUGIN_PANELS))
    for (const surface of surfaces) taken.add(surface)
    if (surfaces.length) regions[region] = surfaces
  }
  return taken.size ? regions : undefined
}

function sanitizeSizes(raw: unknown): Layout['sizes'] {
  const given = record(raw)
  const sizes = Object.entries(SIZE_LIMITS).flatMap(([surface, [min, max]]) => {
    const size = given?.[surface]
    return typeof size === 'number' && Number.isFinite(size) ? [[surface, Math.min(max, Math.max(min, Math.round(size)))]] : []
  })
  return sizes.length ? Object.fromEntries(sizes) : undefined
}

/** A page header's choice: sizes clamped, unknown values and the app's own dropped; undefined when nothing is left. */
export function headerLayout(raw: unknown): HeaderChoice | undefined {
  const given = record(raw)
  const art = HEADER_ART.find((place) => place === given?.art && place !== 'start')
  const actions = HEADER_ACTIONS.find((place) => place === given?.actions)
  const size = given?.artSize
  const header: HeaderChoice = {
    ...(art && { art }),
    ...(typeof size === 'number' && Number.isFinite(size) && { artSize: Math.min(ART_MAX, Math.max(ART_MIN, Math.round(size))) }),
    ...(given?.kicker === false && { kicker: false }),
    ...(given?.sub === false && { sub: false }),
    ...(actions && { actions }),
  }
  return Object.keys(header).length ? header : undefined
}

function sanitizePages(raw: unknown): Pages | undefined {
  const given = record(raw)
  const header = headerLayout(given?.header)
  const parted = (Object.keys(PAGE_PARTS) as PartedPage[]).flatMap((page) => {
    const hideable = PAGE_PARTS[page].filter((part) => !('fixed' in part)).map((part) => part.id)
    const choice = partsChoice(given?.[page], pagePartIds(page), hideable)
    return choice ? [[page, choice]] : []
  })
  const columns = knownList<string>(record(given?.lists)?.columns, MOVABLE_COLUMNS)
  const lists = columns.length ? { columns } : undefined
  return header || lists || parted.length ? { ...(header && { header }), ...(lists && { lists }), ...Object.fromEntries(parted) } : undefined
}

/** Trust boundary (a theme file, stored settings): what is valid is kept; null when nothing is. */
export function sanitizeLayout(raw: unknown): Layout | null {
  const given = record(raw)
  const version = given?.v
  if (!given || typeof version !== 'number' || !Number.isInteger(version) || version < 1) return null
  // A newer app's: a save or a sync from here must not lose it.
  if (version > LAYOUT_API) return JSON.stringify(given).length <= MAX_NEWER_LAYOUT ? (given as unknown as Layout) : { v: version }
  const regions = sanitizeRegions(given.regions)
  const sizes = sanitizeSizes(given.sizes)
  const hidden = surfaceList(given.hidden)
  const parts = sanitizeParts(given.parts)
  const pages = sanitizePages(given.pages)
  if (!regions && !sizes && !hidden.length && !parts && !pages) return null
  return { v: version, ...(regions && { regions }), ...(sizes && { sizes }), ...(hidden.length > 0 && { hidden }), ...(parts && { parts }), ...(pages && { pages }) }
}

/** `named`, then each of `defaults` not yet `placed`, at its default place (after its closest neighbor there). */
function insertUnnamed<Id>(named: readonly Id[], defaults: readonly Id[], placed: (id: Id) => boolean = (id) => named.includes(id)): Id[] {
  const list = [...named]
  defaults.forEach((id, index) => {
    if (placed(id)) return
    const before = defaults.slice(0, index).findLast((other) => list.includes(other))
    list.splice(before === undefined ? 0 : list.indexOf(before) + 1, 0, id)
  })
  return list
}

/** A bar's parts for one container (`group`, in the app's order), as the layout orders and hides them. */
export function arrangeParts<Part extends string>(choice: PartsChoice | undefined, group: readonly Part[]): Part[] {
  return insertUnnamed(knownList(choice?.order, group), group).filter((part) => !choice?.hidden?.includes(part))
}

/** The named surfaces, then each one not named at its default place. */
function placeEverySurface(named: NonNullable<Layout['regions']>): Placement['regions'] {
  const regions = Object.fromEntries(REGIONS.map((region) => [region, [...(named[region] ?? [])]])) as Placement['regions']
  const placed = new Set(Object.values(regions).flat())
  for (const region of REGIONS) regions[region] = insertUnnamed(regions[region], DEFAULT_LAYOUT.regions[region], (surface) => surface === 'brand' || placed.has(surface))
  // A logo not named goes with the top bar.
  if (!placed.has('brand')) regions.top.splice(regions.top.indexOf('topbar'), 0, 'brand')
  return regions
}

/** The logo is never hidden; one of the sidebar and the top bar stays (a way around the app). */
function allowedHidden(hidden: Surface[]): Surface[] {
  const shown = hidden.filter((surface) => surface !== 'brand')
  return shown.includes('sidebar') ? shown.filter((surface) => surface !== 'topbar') : shown
}

/** A block of the window's own column: the bars above and under the middle row (`main`: the page and its columns). */
export type RootBlock = Surface | 'main'

/** A placement as the shell draws it. */
export interface ShellRegions {
  /** Surfaces drawn on each side, in order; the logo among them only when it stands alone. */
  regions: Record<Region, Surface[]>
  /** The logo leads the top bar: just before it there, and whenever Now Playing covers the rest. */
  brandInTopbar: boolean
  /** A hidden top bar keeps what no layout can take: the search, Settings, the window's buttons, the drag area. */
  topbarBare: boolean
  /** Not drawn, still mounted: it holds YouTube's player. */
  playerBarHidden: boolean
  /** The blocks' flex order, when the player bar shows elsewhere than last: it never moves in the page, a moved
   *  video frame reloads. */
  order?: Partial<Record<RootBlock, number>>
}

/** `playerOpen`: Now Playing is up, the top bar carries its Close button. */
export function layoutRegions({ regions, hidden }: Pick<Placement, 'regions' | 'hidden'>, playerOpen = false): ShellRegions {
  const brandInTopbar = playerOpen || regions.top[regions.top.indexOf('topbar') - 1] === 'brand'
  const drawn = (surface: Surface) => (surface === 'brand' ? !brandInTopbar : !hidden.includes(surface) || surface === 'topbar' || surface === 'playerBar')
  const shown = Object.fromEntries(REGIONS.map((region) => [region, regions[region].filter(drawn)])) as ShellRegions['regions']
  const playerBarHidden = hidden.includes('playerBar')
  const column: RootBlock[] = [...shown.top, 'main', ...shown.bottom]
  const inPlace = playerBarHidden || column.at(-1) === 'playerBar'
  return {
    regions: shown,
    brandInTopbar,
    topbarBare: hidden.includes('topbar') && !playerOpen,
    playerBarHidden,
    ...(!inPlace && { order: Object.fromEntries(column.map((block, index) => [block, index])) }),
  }
}

/** The warning's list is read at a glance. */
const MAX_SUMMARY_LINES = 6

/** What a layout changes in the app's own arrangement, one line each; none when it changes nothing here. */
export function layoutSummary(layout: Layout | undefined): string[] {
  const placement = resolveLayout(layout)
  const { regions, sizes, hidden } = placement
  const hides = (surface: Surface) => hidden.includes(surface)
  const on = (region: Region, surface: Surface) => regions[region].includes(surface)
  const logoMoved = !layoutRegions(placement).brandInTopbar
  const partsChanged = Object.entries(PART_GROUPS).some(([surface, groups]) => groups.some((group) => arrangeParts<string>(placement.parts[surface as PartedSurface], group).join() !== group.join()))
  const pageChanged = (page: PartedPage) => arrangeParts(placement.pages[page], pagePartIds(page)).join() !== pagePartIds(page).join()
  const lines = [
    hides('topbar') && tr('A smaller top bar'),
    hides('sidebar') ? tr('No sidebar') : on('right', 'sidebar') && tr('The sidebar on the right'),
    hides('sidePanel') ? tr('No side panel') : on('left', 'sidePanel') && tr('The side panel on the left'),
    hides('playerBar') ? tr('No player bar') : on('top', 'playerBar') && tr('The player bar at the top'),
    logoMoved && on('top', 'brand') && tr('The logo elsewhere at the top'),
    logoMoved && on('bottom', 'brand') && tr('The logo at the bottom'),
    logoMoved && on('left', 'brand') && tr('The logo on the left'),
    logoMoved && on('right', 'brand') && tr('The logo on the right'),
    Object.values(regions).flat().some(pluginOf) && tr('A plugin’s panel beside the page'),
    !!sizes.sidebar && !hides('sidebar') && tr('The sidebar {n} px wide', { n: sizes.sidebar }),
    !!sizes.sidePanel && !hides('sidePanel') && tr('The side panel {n} px wide', { n: sizes.sidePanel }),
    partsChanged && tr('Parts of the bars moved or hidden'),
    !!placement.pages.header && tr('Page headers arranged another way'),
    pageChanged('album') && tr('Album pages arranged their own way'),
    pageChanged('artist') && tr('Artist pages arranged their own way'),
    (pageChanged('songs') || pageChanged('albums') || pageChanged('artists')) && tr('Library lists arranged their own way'),
    pageChanged('home') && tr('Home arranged its own way'),
    (pageChanged('nowPlayingColumns') || pageChanged('nowPlaying') || pageChanged('nowPlayingControls')) && tr('Now Playing arranged its own way'),
    orderColumns(placement.pages.lists?.columns, COLUMNS).join() !== COLUMNS.join() && tr('List columns in another order'),
  ].filter((line) => typeof line === 'string')
  return lines.length > MAX_SUMMARY_LINES ? [...lines.slice(0, MAX_SUMMARY_LINES), tr('And more')] : lines
}

/** A layout is on: themes may arrange the app and this one changes something. */
export const layoutOn = (allowed: boolean, layout: Layout | undefined) => allowed && layoutSummary(layout).length > 0

/** The same theme, colors and CSS only. */
export function withoutLayout<T extends { layout?: Layout }>(theme: T): T {
  const copy = { ...theme }
  delete copy.layout
  return copy
}

/** The placement without the panels of plugins that can't show one: not installed, off, or never allowed to (`ui`).
 *  The same placement when there is nothing to leave out. */
export function withPluginPanels(placement: Placement, plugins: readonly Pick<PluginInfo, 'id' | 'on' | 'granted'>[]): Placement {
  const ready = new Set(plugins.filter((plugin) => plugin.on && plugin.granted.includes('ui')).map((plugin) => plugin.id))
  const shown = (surface: Surface) => {
    const plugin = pluginOf(surface)
    return plugin === undefined || ready.has(plugin)
  }
  if (Object.values(placement.regions).flat().every(shown)) return placement
  return { ...placement, regions: Object.fromEntries(REGIONS.map((region) => [region, placement.regions[region].filter(shown)])) as Placement['regions'] }
}

/** The theme's pages, with the Now Playing parts the user hid by hand hidden too. */
export function withHiddenParts(pages: Pages, hidden: readonly string[]): Pages {
  if (!hidden.length) return pages
  return { ...pages, nowPlaying: { ...pages.nowPlaying, hidden: [...(pages.nowPlaying?.hidden ?? []), ...hidden] } }
}

/** The arrangement to draw for a checked layout; the app's own without one, from a newer app, or on a phone. */
export function resolveLayout(layout: Layout | undefined, phone = false): Placement {
  if (!layout || phone || layout.v > LAYOUT_API) return DEFAULT_LAYOUT
  return { regions: placeEverySurface(layout.regions ?? {}), sizes: layout.sizes ?? {}, hidden: allowedHidden(layout.hidden ?? []), parts: layout.parts ?? {}, pages: layout.pages ?? {} }
}
