# Writing a plugin

A plugin adds a feature to Legato: menu items, a panel, a new look, reactions to what plays, a link to a web
service. It is a folder with two files, installed by the user from **Add-ons › Install a plugin…**. Before anything
runs, the user sees who made it and every permission it asks for, and approves them.

Example: [`examples/plugins/sleep-timer`](../examples/plugins/sleep-timer) (pauses the music after a while, with a
fade). API 2: the Discord presence (what plays, on your Discord profile), which lives in
[legato-app/discord-presence](https://github.com/legato-app/discord-presence) (MIT); the copy in
[`examples/plugins/discord-presence`](../examples/plugins/discord-presence) is the one the app installs for who had
the built-in presence. Legato's bundled plugin follows the app's copy when the app's is newer.

## The folder

```
my-plugin/
  legato.manifest   the manifest
  main.js       the code (one file: bundle if you use several)
  README.md     optional; .md .txt .png .css .json files are copied too (50 files, 5 MB at most)
```

The manifest, JSON. The app reads `legato.manifest` first; `plugin.json` (the older name) is read only when there is
no `legato.manifest`, and it still works:

```json
{
  "id": "com.example.my-plugin",
  "name": "My plugin",
  "version": "1.0.0",
  "author": "Your name",
  "description": "What it does, in one or two sentences.",
  "api": 1,
  "main": "main.js",
  "permissions": ["player:read", "ui"],
  "tags": ["Player"],
  "homepage": "https://example.com/my-plugin",
  "repository": "https://example.com/my-plugin/code",
  "icon": "icon.png"
}
```

- `id`: 3-64 characters, `a-z 0-9 . -`. Installing a folder with the same id updates the plugin; new permissions
  are pointed out and approved again.
- `api`: the plugin API version you wrote for. This app offers **2**; a plugin asking for more is refused with "needs
  a newer version of Legato". Versions only grow: a later app keeps running API 1 plugins. The API 2 permissions need
  `"api": 2` (see below).
- `main`: a `.js` file next to the manifest, 2 MB at most.
- `tags`: optional, 5 words at most (20 characters each), shown on the plugin's card.
- `icon`: optional, a PNG next to the manifest, 256 KB and 512 × 512 pixels at most, shown on the plugin's card and in
  its details once installed. One over the limits (or not a PNG) is not shown. Older versions of Legato pass over it.
- `homepage`, `repository`: https links, optional: the buttons at the bottom of the plugin's details (a repository on
  GitHub also gets a star button).

## Permissions

| Permission | Lets the plugin |
|---|---|
| `player:read` | see what plays (`app.player.state()`), hear `track`, `playing`, `ended`, `seek` and `volume` events |
| `player:control` | play, pause, skip, seek, set the volume, play songs from the library |
| `library:read` | read songs and playlists (no file paths), search the library |
| `library:write` | make playlists and add songs to them |
| `ui` | add menu items, show a panel, show notifications (named after the plugin) |
| `ui:style` | restyle the whole interface with CSS |
| `editor` | read and change the Live Editor's settings |
| `visualizer` | offer a look for the visualizer, hear the music's levels while it shows, draw it |
| `network:<host>` | HTTPS requests to that host only, e.g. `network:api.example.com` |

From API 2 (a manifest asking for them with `"api": 1` is refused):

| Permission | Lets the plugin | Said under it at install |
|---|---|---|
| `discord:presence` | show what plays on your Discord profile | Can show any text and links on your Discord profile, through the Discord app on this PC |
| `player:queue` | see the play queue, and the `queue` event | |
| `history:read` | read your listening history | Sees what you listened to and when |

`discord:presence` methods: `app.discord.set(presence)` → `{ connected, error }`, `app.discord.clear()`,
`app.discord.status()`. `presence`: `{ clientId` (your Discord app's id, digits)`, title, artist, album?, art?` (https,
256 characters at most, not a Discord link, else left out)`, buttons?: [{ label, url }]` (2, label 1-32, https, 512
characters at most)`, playing, positionMs, durationMs?, shows: 'name' | 'artist' | 'song' | 'both' }`. Title, artist
and album are cut at 128 characters. Updates are spaced 4 s apart and retried while Discord is closed; `set` answers
the state known so far. The app adds the small round picture of the playing song's artist by itself (for a song
YouTube plays, asked of YouTube Music sparingly; it may come a moment later).

`app.library.search(query, limit)` (`library:read`): title, artist or album; 100 results at most (the default); a query
of 200 characters at most; one search at a time. It gives songs as `library.tracks()` does. Songs now carry `art`: an
https cover, else null. `app.history.recent({ before?, limit? })` (`history:read`, 500 at most, 100 by default, newest
first, `before` in unix seconds) → `[{ trackId, title, artist, startedAt, listenedMs, completed }]`.

`app.player.queue()` (`player:queue`) → `{ index, tracks: [{ trackId, title, artist, durationMs }] }`, in play order,
500 around the current song. `app.player.enqueue(trackIds, { next })` (`player:control`, library songs, 500 at most).
The `track` event and `player.state().track` also carry `album`, `durationMs`, `art` (https, else null), `youtubeId`
and `page` (the song's https page, else null).

Without any permission a plugin still has its own storage, timers and log.

Never available, whatever the permissions: the user's passwords, tokens and sign-ins, files on the PC, other
plugins' data, the app's own commands, the internet beyond the hosts listed.

## How it runs

Each plugin runs in its own JavaScript engine (QuickJS) inside the app, on its own thread: no web page, no DOM, no
`fetch`, no `require`, no files. Modern JavaScript (classes, `async` / `await`, `Map`, `Promise`, `JSON`, `Date`…) is there,
plus `console.log/warn/error` (shown in the plugin's About › Log), `setTimeout`, `setInterval` (50 ms at least) and
their `clear` functions (64 at most). Limits: 64 MB of memory; each run of its code (start, an event, an answer, a
timer) may take 1 second, after which it is interrupted; interrupted 3 times, the plugin is stopped and its card shows
why. 256 calls can wait for an answer at once.

Everything else goes through the global `app` object. Every call returns a `Promise`; it is rejected with an `Error`
when a permission is missing ("Permission needed: player:control") or the call fails.

## `app` reference

```js
app.id, app.api, app.appVersion   // app.api: the API your manifest declares

// Events. Returns a function that removes the handler.
app.on('track', (t) => {})      // song started: { title, artist, trackId (library id or null), via } or null
app.on('playing', (yes) => {})  // true / false
app.on('panel', ({ id, value }) => {})   // a control of your panel was used
app.on('command', ({ id, context }) => {}) // also run by addCommand's `run`

// player:read / player:control
await app.player.state()   // { track, playing, positionMs, durationMs, volume (0..1) }
await app.player.play(); await app.player.pause(); await app.player.toggle()
await app.player.next(); await app.player.previous()
await app.player.seek(ms); await app.player.volume(0.5)
await app.player.playTracks([trackId, …], startIndex)

// library:read / library:write
await app.library.tracks()      // [{ id, title, artist, album, durationMs, sources: ['youtube', …] }]
await app.library.playlists()   // [{ id, name, custom, source, trackCount }]
await app.library.playlist(id)  // { id, name, custom, tracks: […] }
await app.playlists.create(name)      // new playlist id
await app.playlists.add(id, [trackId, …])

// ui
await app.ui.notify('Done')
await app.ui.addCommand({ id: 'x', title: 'Do it', where: ['player', 'track', 'playlist'], run: (context) => {} })
//   context: track { trackId, title, artist }, playlist { playlistId, name }, player { trackId, title, artist }
await app.ui.removeCommand('x')
await app.ui.setPanel([ …parts… ])   // shown from the plugin's cog in Add-ons

// ui:style
await app.ui.setStyle('.some-class { … }')   // links and @import are taken out

// editor
await app.editor.get()          // Live Editor settings (speed, tempo, pitch, bass, eq, reverb, echo, space…)
                                // eq: 10 gains in dB, 32 Hz to 16 kHz an octave apart (5 gains = the older bands)
await app.editor.set({ ...settings, speed: 0.8 })

// visualizer
await app.visualizer.register({ name: 'Rings' })  // your look among the visualizer's styles (one per plugin)
app.on('visualizer', (f) => {})  // while your look shows and music plays: 30 a second at most, the latest only
//   { bands: [31 numbers 0..1, low to high, a third of an octave apart], beat (a beat since the last frame),
//     bpm (or null), level and peak (the louder side, dBFS) }
app.visualizer.draw([ …shapes… ])  // the picture until the next one; nothing comes back, 60 a second, 256 kB each

// storage (always allowed, 1 MB per plugin, JSON values)
await app.storage.set('key', { any: 'json' }); await app.storage.get('key')
await app.storage.remove('key'); await app.storage.keys()

// network:<host>
const r = await app.net.fetch('https://api.example.com/v1/x', { method: 'POST', headers: { 'X-Api-Key': '…' }, body: '…' })
// { status, contentType, body (text) }; JSON.parse(r.body) for JSON
```

### API 2 calls and events

```js
// player:read: events
app.on('ended', ({ trackId, listenedMs, completed }) => {})  // library songs
app.on('seek', ({ positionMs }) => {})
app.on('volume', ({ volume }) => {})

// player:queue
app.on('queue', (queue) => {})                 // the same shape as queue(); once every 500 ms at most
await app.player.queue()                       // { index, tracks: [{ trackId, title, artist, durationMs }] }
await app.player.enqueue([trackId, …], { next: true })   // player:control

// library:read
await app.library.search('query', 20)          // songs, as library.tracks() gives them

// history:read
await app.history.recent({ before, limit })    // newest first

// discord:presence
await app.discord.set({ clientId, title, artist, album, art, buttons, playing, positionMs, durationMs, shows })
await app.discord.clear()
await app.discord.status()
```

### Panel parts

A panel is data, drawn by the app in its own look (no HTML from plugins). Unknown parts are dropped; 300 parts, 6
levels at most.

```js
{ type: 'heading', text }
{ type: 'text', text, muted? }
{ type: 'button', id, label, primary? }              // panel event: { id, value: null }
{ type: 'toggle', id, label, value }                 // value: true / false
{ type: 'slider', id, label, min, max, step?, value } // value: number
{ type: 'input', id, label, value }                  // value: text (on Enter or leaving the field)
{ type: 'select', id, label, value, options: [{ value, label }] }
{ type: 'tracks', ids: [trackId, …] }                // library songs, click to play
{ type: 'row', children: [ …parts… ] }
{ type: 'divider' }
```

Controls show the value you give: after an event, call `setPanel` again with the new state.

### Visualizer shapes

A picture is data too, drawn by the app on the visualizer's canvas, full screen or in the strip. Positions are shares
of the box: `x` 0 (left) to 1 (right), `y` 0 (top) to 1 (bottom), -1 to 2 to go past the edges. A circle's `r` is a
share of the box's shorter side; widths and text sizes are CSS pixels. `color`: `'ink'` (the visualizer's own colour,
the default), `'warn'` (its alarm red) or `#rgb` / `#rrggbb` / `#rrggbbaa`; `alpha` 0..1, 1 by default. Unknown shapes
are dropped; 1000 shapes and 8000 points at most.

```js
{ op: 'rect', x, y, w, h }                             // filled
{ op: 'line', points: [x1, y1, x2, y2, …], width? }    // width 1.5 by default
{ op: 'shape', points: [x1, y1, x2, y2, x3, y3, …] }   // closed and filled
{ op: 'circle', x, y, r, width? }                      // a ring that wide; width 0 (the default): a disc
{ op: 'text', x, y, text, size?, align? }              // y is the text's middle; size 14, align 'left' / 'center' / 'right'
```

Frames come only while your look is on screen with music playing, so a plugin draws nothing the rest of the time.
When your plugin is off or stopped, the visualizer shows its bars in your look's place. Example:
`examples/plugins/rings`.

## Verified

A plugin shows **Verified** next to its author when Legato finds that author's signature on it: the author is in the
list built into the app (`crates/plugins/trusted-authors.json`), the signature holds for their key, and every file in
the folder is the one signed. A file changed, added or removed since, another name in the manifest, or any other key:
**Not verified**. It says who made the plugin and that it is unchanged, nothing more: the permissions asked at install
still apply, and nobody reads your code for you. Everyone else's plugins work the same, as Not verified.

A listed author signs a folder that holds only what the app installs (the manifest and `.js`, `.json`, `.md`, `.txt`,
`.png` and `.css` files, no sub-folder), after the last change to any of them, from Legato's repository:

```sh
node scripts/plugin-files.mjs path/to/my-plugin
pnpm tauri signer sign -f path/to/private.key path/to/my-plugin/legato.files
```

The first writes `legato.files` (each file's SHA-256 and name), the second `legato.files.sig`; ship both with the
plugin. The files must reach the user byte for byte (a Git checkout that rewrites line endings breaks the signature:
`* -text` in the plugin's `.gitattributes`). The key pair comes from `pnpm tauri signer generate -w path/to/private.key`;
the private key never goes in a repository.

## During a blind test

While a blind test is open, plugins learn nothing of what plays: it would give the answer away.

- `playing` false is sent as it opens, then no `track`, `playing`, `seek`, `ended` or `queue` event.
- `player.state()` and `player.queue()` answer as with nothing playing (`volume` 0).
- `history.recent()` answers `[]`.
- When it closes, `track`, `playing` and `queue` are sent once with how the player stands.

## Try it

1. Write the folder anywhere.
2. Add-ons › Install a plugin… › pick the folder › Install.
3. Change the code, install the folder again (same id: it updates and restarts).
4. Errors and `console.log` lines: the plugin's About (ⓘ) › Log.

## Versions of this API

- **1** (2026-10): everything in the API 1 part of the reference: the events `track`, `playing`, `panel`, `command`;
  the player, library, playlist, `ui`, `ui:style`, `editor`, `network` and storage calls. `visualizer` (permission,
  calls, event, shapes) added within API 1 in 2026-11.
- **2** (2026-11): the permissions `discord:presence`, `player:queue` and `history:read`, and the calls and events under
  "API 2 calls and events" (`app.discord.*`, `app.history.recent`, `app.library.search`, `app.player.queue` and
  `enqueue`, the `ended`, `seek`, `volume` and `queue` events). The `track` event and `player.state().track` gain
  `album`, `durationMs`, `art`, `youtubeId` and `page`. A plugin asking for an API 2 permission needs `"api": 2` in its
  manifest; an API 1 manifest asking for one is refused. The manifest's `repository` field and the `legato.manifest`
  name are read whatever the `api` says.

New features come as new methods, events or parts within the current API when nothing existing changes meaning;
anything that would break a plugin waits for a new API version, and older plugins keep working.
