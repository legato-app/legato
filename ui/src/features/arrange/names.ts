/** The surfaces' names, and where one is now, as said to a screen reader. */
import { msg, tr } from '../../shared/i18n/i18n'
import { pluginOf, type BuiltinSurface, type Placement, type Region, type Surface } from '../../shared/theme/layout'

const NAMES: Record<BuiltinSurface, string> = { brand: msg('Logo'), topbar: msg('Top bar'), sidebar: msg('Sidebar'), sidePanel: msg('Side panel'), playerBar: msg('Player bar') }

const WHERE: Record<Region, string> = { left: msg('{part} on the left'), right: msg('{part} on the right'), top: msg('{part} at the top'), bottom: msg('{part} at the bottom') }

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
  const side = tr(WHERE[region], { part: name })
  return surfaces.length > 1 ? `${side}, ${tr('{position} of {count}', { position: surfaces.indexOf(surface) + 1, count: surfaces.length })}` : side
}
