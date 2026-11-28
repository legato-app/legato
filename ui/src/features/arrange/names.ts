/** The surfaces' names, and where one is now, as said to a screen reader. */
import { isRtl, lang, msg, tr } from '../../shared/i18n/i18n'
import { mirroredSide, partGroup } from '../../shared/theme/arrange'
import { arrangeParts, pluginOf, type BuiltinSurface, type PartedSurface, type Placement, type Region, type Surface } from '../../shared/theme/layout'

const NAMES: Record<BuiltinSurface, string> = { brand: msg('Logo'), topbar: msg('Top bar'), sidebar: msg('Sidebar'), sidePanel: msg('Side panel'), playerBar: msg('Player bar') }

const WHERE: Record<Region, string> = { left: msg('{part} on the left'), right: msg('{part} on the right'), top: msg('{part} at the top'), bottom: msg('{part} at the bottom') }

export const PART_NAMES: Record<PartedSurface, Record<string, string>> = {
  playerBar: {
    song: msg('Song'),
    center: msg('Center'),
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
}

export const partName = (surface: PartedSurface, part: string) => tr(PART_NAMES[surface][part] ?? part)

/** Where a bar's part is: hidden, or its place among those its container shows. */
export function whereIsPart(placement: Placement, surface: PartedSurface, part: string, name: string): string {
  const choice = placement.parts[surface]
  if (choice?.hidden?.includes(part)) return tr('{part} hidden', { part: name })
  const shown = arrangeParts(choice, partGroup(surface, part))
  return `${name}, ${tr('{position} of {count}', { position: shown.indexOf(part) + 1, count: shown.length })}`
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
