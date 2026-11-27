import { openUrl } from '@tauri-apps/plugin-opener'
import { tr } from '../../shared/i18n/i18n'
import { SourceIcon } from '../../shared/ui/SourceIcon'
import { spotifyPage } from './spotifyPage'
import { notifyError } from '../../app/notifyError'

/** Under an imported Spotify playlist's title: where it comes from (Spotify's policy: its mark, 21 px at least, in one color) and the way back there. */
export function SpotifyAttribution({ sourceId }: { sourceId: string }) {
  const page = spotifyPage(sourceId)
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="flex items-center gap-2">
        <SourceIcon source="spotify" size={21} />
        {tr('Imported from Spotify')}
      </span>
      {page && (
        <button type="button" onClick={() => void openUrl(page).catch((e: unknown) => notifyError(e))} className="text-xs font-bold tracking-wide uppercase underline-offset-4 hover:underline">
          {tr('Open Spotify')}
        </button>
      )}
    </p>
  )
}
