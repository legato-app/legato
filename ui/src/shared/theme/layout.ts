/**
 * A theme's arrangement of the app's shell. Data only, checked here: a layout grants nothing, it only moves the shell's
 * own parts. Pure: no window, no settings.
 */

/** The layouts this app draws. Within a version only additions; a newer one is kept as it came and not applied. */
export const LAYOUT_API = 1
/** A newer version's layout is kept up to this size, in characters of JSON: themes live in the settings. */
const MAX_NEWER_LAYOUT = 8_000

/** The four sides of the page, which always keeps the middle. */
export const REGIONS = ['top', 'left', 'right', 'bottom'] as const
export type Region = (typeof REGIONS)[number]
export const SURFACES = ['brand', 'topbar', 'sidebar', 'sidePanel', 'playerBar'] as const
export type Surface = (typeof SURFACES)[number]

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
const PLACES: Record<Surface, readonly Region[]> = { brand: REGIONS, topbar: ['top'], sidebar: ['left', 'right'], sidePanel: ['left', 'right'], playerBar: ['top', 'bottom'] }

/** The theme file's `layout` key. */
export interface Layout {
  v: number
  regions?: Partial<Record<Region, Surface[]>>
  sizes?: Partial<Record<SizedSurface, number>>
  hidden?: Surface[]
}

/** What the shell draws: every surface in one region, in order. */
export interface Placement {
  regions: Record<Region, Surface[]>
  sizes: Partial<Record<SizedSurface, number>>
  hidden: Surface[]
}

/** The app's own arrangement. */
export const DEFAULT_LAYOUT: Placement = { regions: { top: ['brand', 'topbar'], left: ['sidebar'], right: ['sidePanel'], bottom: ['playerBar'] }, sizes: {}, hidden: [] }

const record = (value: unknown): Record<string, unknown> | null => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null)
const isSurface = (value: unknown): value is Surface => SURFACES.includes(value as Surface)

/** Known surfaces, each once. */
const surfaceList = (raw: unknown): Surface[] => [...new Set(Array.isArray(raw) ? raw.filter(isSurface) : [])]

/** Each surface in the first region that names it and can hold it. */
function sanitizeRegions(raw: unknown): Layout['regions'] {
  const named = record(raw)
  const taken = new Set<Surface>()
  const regions: Partial<Record<Region, Surface[]>> = {}
  for (const region of REGIONS) {
    const surfaces = surfaceList(named?.[region]).filter((surface) => PLACES[surface].includes(region) && !taken.has(surface))
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
  if (!regions && !sizes && !hidden.length) return null
  return { v: version, ...(regions && { regions }), ...(sizes && { sizes }), ...(hidden.length > 0 && { hidden }) }
}

/** The named surfaces, then each one not named at its default place (after its default neighbor there). */
function placeEverySurface(named: NonNullable<Layout['regions']>): Placement['regions'] {
  const regions = Object.fromEntries(REGIONS.map((region) => [region, [...(named[region] ?? [])]])) as Placement['regions']
  const placed = new Set(Object.values(regions).flat())
  for (const region of REGIONS) {
    DEFAULT_LAYOUT.regions[region].forEach((surface, index, defaults) => {
      if (surface === 'brand' || placed.has(surface)) return
      const before = defaults.slice(0, index).findLast((other) => regions[region].includes(other))
      regions[region].splice(before ? regions[region].indexOf(before) + 1 : 0, 0, surface)
    })
  }
  // A logo not named goes with the top bar.
  if (!placed.has('brand')) regions.top.splice(regions.top.indexOf('topbar'), 0, 'brand')
  return regions
}

/** The logo is never hidden; one of the sidebar and the top bar stays (a way around the app). */
function allowedHidden(hidden: Surface[]): Surface[] {
  const shown = hidden.filter((surface) => surface !== 'brand')
  return shown.includes('sidebar') ? shown.filter((surface) => surface !== 'topbar') : shown
}

/** The arrangement to draw for a checked layout; the app's own without one, from a newer app, or on a phone. */
export function resolveLayout(layout: Layout | undefined, phone = false): Placement {
  if (!layout || phone || layout.v > LAYOUT_API) return DEFAULT_LAYOUT
  return { regions: placeEverySurface(layout.regions ?? {}), sizes: layout.sizes ?? {}, hidden: allowedHidden(layout.hidden ?? []) }
}
