// Discord presence: what plays on your Discord profile, through the Discord app on this PC.
// A Legato plugin (docs/plugins.md, API 2). Runs in its own sandbox: everything goes through `app`.

const REPO = 'https://github.com/legato-app/legato'
// Discord draws the progress bar from start and end: a start moved by less than this is the same.
const DRIFT_MS = 3000

const settings = { clientId: '', shows: 'song', paused: false, buttons: true, github: true }
let sent = null
let sentAt = 0
let trouble = null

/** What Discord should show now. null = nothing (stopped, or paused when pauses are hidden). */
function presenceFor({ track, playing, positionMs, durationMs }) {
  if (!track || (!playing && !settings.paused)) return null
  const buttons = []
  if (settings.buttons && track.youtubeId) buttons.push({ label: 'Listen on YouTube', url: track.page })
  else if (settings.buttons && track.page) buttons.push({ label: 'Listen on Apple Music', url: track.page })
  if (settings.github) buttons.push({ label: 'Get App On GitHub', url: REPO })
  return {
    clientId: settings.clientId,
    title: track.title,
    artist: track.artist,
    album: track.album,
    // Discord fetches the cover itself.
    art: track.art ?? (track.youtubeId ? `https://i.ytimg.com/vi/${track.youtubeId}/hqdefault.jpg` : null),
    buttons,
    playing,
    positionMs: Math.max(0, Math.round(positionMs)),
    durationMs: durationMs ? Math.round(durationMs) : null,
    shows: settings.shows,
  }
}

/** Same song and state, its start moved a little: nothing to send. */
function samePresence(a, aAt, b, bAt) {
  if (!a || !b) return a === b
  const { positionMs: aPosition, ...aRest } = a
  const { positionMs: bPosition, ...bRest } = b
  if (JSON.stringify(aRest) !== JSON.stringify(bRest)) return false
  return !a.playing || Math.abs(aAt - aPosition - (bAt - bPosition)) < DRIFT_MS
}

async function update() {
  if (!/^\d{1,32}$/.test(settings.clientId)) return
  const presence = presenceFor(await app.player.state())
  const now = Date.now()
  if (samePresence(sent, sentAt, presence, now)) return
  sent = presence
  sentAt = now
  if (!presence) return app.discord.clear()
  const { error } = await app.discord.set(presence)
  if (error !== trouble) {
    trouble = error
    await panel()
  }
}

function panel() {
  return app.ui.setPanel([
    { type: 'heading', text: 'Discord presence' },
    { type: 'text', muted: true, text: 'Needs your own Discord application: copy its Application ID from discord.com/developers.' },
    { type: 'input', id: 'clientId', label: 'Application ID', value: settings.clientId },
    {
      type: 'select',
      id: 'shows',
      label: 'After "Listening to"',
      value: settings.shows,
      options: [
        { value: 'name', label: 'The app’s name' },
        { value: 'artist', label: 'The artist' },
        { value: 'song', label: 'The song' },
        { value: 'both', label: 'Both' },
      ],
    },
    { type: 'toggle', id: 'paused', label: 'Show while paused', value: settings.paused },
    { type: 'toggle', id: 'buttons', label: 'Button to the song', value: settings.buttons },
    { type: 'toggle', id: 'github', label: 'Button to Legato on GitHub', value: settings.github },
    ...(trouble ? [{ type: 'text', text: trouble }] : []),
  ])
}

app.on('panel', async ({ id, value }) => {
  if (!(id in settings)) return
  settings[id] = typeof value === 'string' ? value.trim() : value
  await app.storage.set(id, settings[id])
  await panel()
  await update()
})
app.on('track', update)
app.on('playing', update)
app.on('seek', update)

async function start() {
  for (const key of Object.keys(settings)) {
    const kept = await app.storage.get(key)
    if (typeof kept === typeof settings[key]) settings[key] = kept
  }
  await panel()
  await update()
}
start()
