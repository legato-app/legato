import { UsersThree, WifiHigh } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { useStore } from '../../app/store'
import { api, type NearbyState, type ShareCode } from '../../shared/api'
import { Button } from '../../shared/ui/Button'
import { Dialog } from '../../shared/ui/Dialog'
import { qrPath } from './qr'
import { tr, trn } from '../../shared/i18n/i18n'
import { usePlayer } from '../player/store'
import { inRoom, openRoom, useRoom } from '../rooms/room'
import { CopyField } from '../../app/CopyField'
import { offered } from '../../shared/liteCuts'

/** Listen together: this playlist plays here in a room friends on the network follow. */
function Together({ id, onClose }: { id: number; onClose: () => void }) {
  const hosting = useRoom((s) => s.status?.role === 'host')
  const busy = useRoom((s) => inRoom(s.status) && s.status?.role !== 'host')
  const go = async () => {
    try {
      const tracks = await api.playlistTracks(id)
      if (tracks.length) usePlayer.getState().playTracks(tracks, 0)
      if (!hosting) await import('../rooms/rooms').then((m) => m.startRoom())
      onClose()
      openRoom()
    } catch (e) {
      useStore.setState({ error: String(e) })
    }
  }
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-line px-4 py-3">
      <p className="flex items-center gap-2 text-xs font-semibold">
        <UsersThree size={16} className="text-ink-2" /> {tr('Listen together')}
      </p>
      <p className="text-xs text-ink-2">{tr('Play it here in a room: friends on the same network follow it, each from their own source.')}</p>
      <Button variant="ghost" className="w-fit" disabled={busy} onClick={() => void go()}>
        {hosting ? tr('Play it in your room') : tr('Start a room with it')}
      </Button>
    </div>
  )
}

/** Same network: 6-digit code to read out ("grandma code"). Offer withdrawn when the panel closes. */
function Nearby({ id }: { id: number }) {
  const [code, setCode] = useState<string>()
  const [status, setStatus] = useState<NearbyState>()
  useEffect(() => () => void api.nearbyStop(), [])
  useEffect(() => {
    if (!code) return
    const t = setInterval(() => api.nearbyStatus().then(setStatus), 1000)
    return () => clearInterval(t)
  }, [code])
  const start = () => {
    setStatus(undefined)
    api
      .nearbySend(id)
      .then(setCode)
      .catch((e) => useStore.setState({ error: String(e) }))
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-line px-4 py-3">
      <p className="flex items-center gap-2 text-xs font-semibold">
        <WifiHigh size={16} className="text-ink-2" /> {tr('Send to a nearby Legato')}
      </p>
      {!code || status?.state === 'failed' ? (
        <>
          <p className="text-xs text-ink-2">{status?.state === 'failed' ? status.error : tr('Same Wi-Fi or network, a 6-digit code to read out. Windows may ask to allow Legato on private networks.')}</p>
          <Button variant="ghost" className="w-fit" onClick={start}>
            {code ? tr('New code') : tr('Get a code')}
          </Button>
        </>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <span className="font-mono text-[2.125rem] leading-none tracking-[0.12em] tabular-nums">
            {code.slice(0, 3)} {code.slice(3)}
          </span>
          <span className="text-end text-xs text-ink-2">{status?.state === 'sent' ? tr('Sent.') : tr('On the other app: Add music › Import, type this code. Valid 10 min.')}</span>
        </div>
      )}
    </div>
  )
}

/** Share a playlist: QR code (scan or screenshot) and link (messages). */
export function SharePanel({ id, name, onClose }: { id: number; name: string; onClose: () => void }) {
  const [code, setCode] = useState<ShareCode>()
  useEffect(() => {
    api
      .sharePlaylist(id)
      .then(setCode)
      .catch((e) => {
        useStore.setState({ error: String(e) })
        onClose()
      })
  }, [id, onClose])

  return (
    <Dialog title={tr('Share “{name}”', { name })} kicker={code ? `${trn(code.tracks, '{n} track', '{n} tracks')} · ${trn(code.bytes, '{n} byte', '{n} bytes')}` : tr('Share')} onClose={onClose}>
      {code && (
        <>
          {code.qr ? (
            <figure className="flex flex-col items-center gap-3">
              {/* Black on white whatever the theme: scanners need it. */}
              <svg viewBox={`0 0 ${code.qr[0] + 8} ${code.qr[0] + 8}`} shapeRendering="crispEdges" role="img" aria-label={tr('QR code of the playlist')} className="w-full max-w-72 rounded-lg">
                <rect width="100%" height="100%" fill="#FFFFFF" />
                <path d={qrPath(code.qr[0], code.qr[1], 4)} fill="#000000" />
              </svg>
              <figcaption className="text-center text-xs text-ink-2">{tr('Scan it, or send a screenshot: Legato reads the code from the image (drop it on the window).')}</figcaption>
            </figure>
          ) : (
            <p className="rounded-lg border border-line bg-recess px-3.5 py-3 text-xs">{tr('Too many tracks for a QR code: send the link instead.')}</p>
          )}
          <div className="flex flex-col gap-1.5">
            <span className="kicker">{tr('Link · opens in any browser, or paste it anywhere in Legato (Ctrl+V)')}</span>
            <CopyField value={code.link} />
          </div>
          <Nearby id={id} />
          {offered('listeningRooms') && <Together id={id} onClose={onClose} />}
          <p className="text-xs text-ink-2">{tr('The code holds the track list only: YouTube and Apple Music ids, or artist and title. No account, no server.')}</p>
        </>
      )}
    </Dialog>
  )
}
