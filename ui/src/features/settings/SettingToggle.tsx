import { useSettings } from '../../app/settings'
import { tr } from '../../shared/i18n/i18n'
import type { Settings } from '../../shared/theme/theme'
import { Toggle } from '../../shared/ui/controls'
import { labelOf } from './catalog'

/** The settings that are on or off. */
export type SwitchSetting = { [Key in keyof Settings]: Settings[Key] extends boolean ? Key : never }[keyof Settings]

/** A setting's switch, reading and writing it itself, named like its row (`label`: the row's id). */
export function SettingToggle({ setting, label }: { setting: SwitchSetting; label: string }) {
  const checked = useSettings((state) => state.settings[setting])
  return <Toggle label={tr(labelOf(label))} checked={checked} onChange={(on) => useSettings.getState().update({ [setting]: on })} />
}
