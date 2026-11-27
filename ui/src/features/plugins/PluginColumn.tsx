import { useNarrow } from '../../shared/phone'
import { onMenu } from '../../shared/ui/ContextMenu'
import { pluginPanelMenu } from '../menus'
import { usePlugins } from './host'
import { PluginPanel } from './PluginPanel'

/** A plugin's panel as a column of the app, where a theme's layout names it (`plugin:<id>`). */
export function PluginColumn({ plugin }: { plugin: string }) {
  const installed = usePlugins((s) => s.list.find((p) => p.id === plugin))
  // A narrow window: the page keeps the room, as with the side panel.
  const narrow = useNarrow()
  if (!installed || narrow) return null
  const name = installed.manifest?.name ?? plugin
  return (
    <aside aria-label={name} onContextMenu={onMenu(() => pluginPanelMenu(installed))} className="flex w-75 shrink-0 flex-col gap-3 overflow-y-auto rounded-lg bg-panel p-3 phone:hidden">
      <h2 className="text-sm font-medium">{name}</h2>
      <PluginPanel plugin={plugin} />
    </aside>
  )
}
