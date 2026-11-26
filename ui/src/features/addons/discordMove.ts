import { useSettings } from '../../app/settings'
import { useStore } from '../../app/store'
import { api } from '../../shared/api'
import { tr } from '../../shared/i18n/i18n'
import { phoneApp } from '../../shared/platform'

/** The old add-on's switch in `settings.addons`. */
const DISCORD = 'discord-presence'

/** Once, for who had the built-in Discord presence on: it becomes the bundled plugin, settings and all. */
export function startDiscordMove(): () => void {
  const { addons, discord } = useSettings.getState().settings
  // Plugins are the PC's only; a phone leaves the switch for the PC it syncs from.
  if (!phoneApp && addons[DISCORD]) {
    api.pluginAdoptDiscord(discord).then(
      (done) => {
        if (!done) return
        const { settings, update } = useSettings.getState()
        update({ addons: { ...settings.addons, [DISCORD]: false } })
        // Kept: the plugin was installed by hand, with settings of its own.
        useStore.getState().notify(done === 'moved' ? tr('Discord presence is now a plugin, with your settings: see Add-ons') : tr('Discord presence: your plugin is in Add-ons'), { kind: 'info' })
      },
      (e: unknown) => useStore.setState({ error: String(e) }),
    )
  }
  return () => {}
}
