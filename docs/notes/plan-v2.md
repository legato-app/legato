# Legato: plan

Open work only. Tick a line when it lands; drop ticked lines once a release ships them. Everything done before
(phases 1 to 8, the big update, the redesign, the product pass, roadmap milestones 0 to 2, the user's choices along the
way) is in git: `git log -p docs/notes/plan-v2.md`, and in the release notes.

Stable: 1.2.10 (2026-11-14). Next: the lines the owner chose on 2026-11-07 (their answers: Waiting on the user),
then milestone 3, Platforms; Against Liner 6 with the owner at the PC. Where the work stands: [handoff.md](handoff.md).

Every idea here stays: the user wants them all built in the end, just later (user's choice 2026-10-31). The roadmap sets
the order; a line leaves only when it ships or the user drops it.

## The owner's reports and asks of 2026-11-18

- [x] `S` The window frozen on a blurred picture about two minutes after launch, on one PC only (the owner, 2026-11-27,
      v1.2.416). Cause (`diagnostics.log` + WebView2 crash dumps at the same seconds): the hidden Google session refresh
      (`ytm::refresh`, 90 s after launch) got a passkey request from Google's page on a PC with Windows Hello; closing
      the window under it killed WebView2's browser process, and every webview with it. Fixed 2026-11-27: the hidden
      page has no `navigator.credentials` and leaves for `about:blank` before closing (`ytm.rs`); a dead browser process
      restarts the app, once (`webview_watch.rs`). Not tried for real: no build installed on that PC.
- [x] `M` Songs filled with songs never played (the owner, 2026-11-19: « dans songs ya full songs que je n'ai JAMAIS
      ecouter [...] trouve cde bug »). Cause: a YouTube Music mix saved to the library (id `RD…`: a radio YouTube makes
      up again at each request) was synced every 15 min; each sync put other songs in it, and the ones it dropped
      stayed in the library (`save_playlist` replaces a list's songs, never their rows). Fixed 2026-11-19: the library
      listing skips `RD…` lists except YouTube's own fixed playlists (`RDCLAK…`), `ytmusic.rs` `list_playlists`; the mix
      already imported stays as it is. NOT done, the owner's call: the rows already added (no playlist,
      never played) are not removed; a visible "Clean up songs" with undo would be the way.
      2026-11-27: the owner’s call of 2026-11-26 (automatic at the update, a backup first) was in since `5789ef7d`: once
      per library, at the first start after the update, after the first screen (`deferred.rs` → `backup::remove_old_mixes`:
      a copy next to the library, then `remove_made_up_mixes`, marked `mixCleanup1`; the copy leaves after 30 days). It
      removes the made-up mixes still in the library and the songs only they hold that were never played, liked, rated or
      put elsewhere. Tests in core; never run on a real library.
      Decided alone (2026-11-27): ticked on that; the songs the mixes had already dropped have their own line below.
- [ ] `S` Songs old mixes dropped, now in no playlist and never played (for the owner): not told apart from songs added
      by hand or by link, so nothing removes them; a “Clean up songs” that shows them first, with undo, would be the
      way. (to check: 5789ef7d cleans them out once after a copy; is the visible, undoable Clean up still wanted?)
- [x] `M` Disconnecting Spotify asks once to keep or remove what only Spotify brought, a library backup made first (the
      owner, 2026-11-26). 2026-11-27: the question after Disconnect removes the imported playlists and the songs only
      Spotify knows that nothing else holds (`library::cleanup`, the mix cleanup’s rule: no other source, no list that
      stays, no like, play, rating, preference, bookmark, edit or word of the user’s); the copy leaves after 30 days.
      Tests in core, not tried for real.
      Decided alone (2026-11-27): one question (the playlists-only one is gone); a song already matched to a YouTube video
      has another source and stays; an older Spotify “Liked Songs” list stays, with its songs. Limit: Sync Mode removes the
      playlists on the other PCs, and since 2026-11-27 the songs too (next line). Not recorded as removed, as Remove from
      library does: that would delete them from the other PCs with their plays and playlists there, and a later Spotify
      import would skip them.
- [x] `M` Sync Mode carries the Spotify-disconnect removal: a synced PC brings the removed songs back today. Recording them
      as `removed` would also delete the other PCs’ unsynced history and playlists, so it needs a record kind of its own
      (night window 2, 2026-11-27).
  - 2026-11-27: done, two record kinds (`docs/sync-mode.md` › Conflicts), no schema or file format bump; tests in core
    between two libraries. Not tried for real (two real PCs).
    - Decided alone (2026-11-27): another PC applies the disconnect’s own rule to its own rows, at every merge. A song
      added again by hand or kept as a like ends its record, as an import does, so the next merge leaves it.
    - Limit: an older Legato keeps the songs until it updates (the question says it).
    - 2026-11-27 (review): an `import-back` comes after the record it ends even on a PC whose clock is behind (else a
      song added by hand there was swept).
- [ ] `M` Adaptive Sound as the owner meant it (2026-11-19, from the phone: « adaptive sound n'est pas dutout ce que je
      voulais prcq perso je voulais que en mode sa soit comme de base le song mais juste que sa detecte le volume de la
      video et que sa le stabilise sur le volume que tu veux sans avoir de gros haut ou de gros bas prcq la les bouton et
      tout c pas ouf et en plus sa doit rien changer et enleve la bar en dessous »). Built 2026-11-19 (`docs/playback.md`
      › Adaptive Sound): one gain per song from its integrated, gated loudness (was: the last 3 s, which flattened verses
      and choruses), same in `crates/dsp` and `live.js`; a YouTube song heard before starts at its gain; no compression,
      no EQ; the switch and the line under the volume removed, Settings › Sound processing keeps the switch and the level.
      Decided alone: Volume levelling stays a separate setting (Adaptive Sound takes over while on, said in Settings).
      NOT ticked: to try on the phone and the PC: (1) Adaptive Sound on, Normal, a song with a quiet start and a loud
      chorus: the start stays quiet, the chorus loud, no swell. (2) A quiet song then a loud one: both about as loud,
      with no jump between. (3) Quiet / Loud: the whole song softer or louder, nothing else changed.
- [x] `S` The phone's app icon is not Legato's (the owner, 2026-11-19: « sur mobile ça date mais l'icône de l'app est pas la bonne »). Cause, seen on the files: `src-tauri/gen/android/.../res/mipmap-*` still held `tauri android init`'s default (the Tauri logo) since `b0156300`. Done 2026-11-19: the launcher is an adaptive icon (`mipmap-anydpi-v26/ic_launcher.xml` and `_round`: the playback blue `#7CB8FF` of `docs/design.md` behind the L of `src-tauri/icons/icon.svg`, kept inside the 66 dp safe zone, as vectors in `drawable/` and `drawable-v24/`), the legacy PNGs regenerated by `pnpm tauri icon` from `icon.png` (only the Android ones copied; the desktop icons are untouched), and the media notification's status-bar mark is Legato's L in white (`drawable/ic_stat_legato.xml`, `PlaybackService.kt`; it was Android's play triangle). The update notification keeps the system's download glyphs (they say what it does). Decided alone: vectors for the adaptive layers instead of PNG foregrounds; no `roundIcon` in the manifest (adaptive icons round themselves). NOT built or run (no Android toolchain here): to try on the phone: a fresh install or a launcher refresh may be needed to see it.

- [x] `M` Lyrics animations to improve (the owner, 2026-11-18; only noted, nothing built, no detail given yet): what to
      change is to ask them when it is taken (the line change, the word-by-word fill, the scroll between lines, the karaoke
      look, the backdrop under the lyrics?). Read first: the lyrics panel and `Karaoke.tsx` in `ui/src/features/player/`,
      their motion settings (`motion`, `backdropMotion`) and reduced motion; keep it cheap (no per-line filters, the owner's
      GPU driver has reset under load) and honour Windows' reduce-motion as the flowing backdrop does (`allowsMotion`).
      Done 2026-11-18: the panel now glides on a transform (FLIP) with Karaoke's recipe (`LEAD_MS`, `GLIDE`, `glideFrom` in
      `karaokeLines.ts`), both honour `allowsMotion`, a seek across the song jumps. NOT tried: a real song with real timed
      lyrics, light theme, 375 px, reduced motion on; word-by-word fill NOT built (the app keeps lines only, `Timed`).
      Decided alone (2026-11-18): no word fill, no new setting, no blur.

- [x] `M` A picture dragged from Discord (the owner, 2026-11-18; only noted, nothing built): Discord drops a link to its
      CDN (`cdn.discordapp.com`, `media.discordapp.net`; signed links that expire), not a file. Take it like a dropped
      picture, fetched in Rust, never by the page; what each kind is for (a shared card's code, a cover…) to settle when
      it is built. Also Legato's own files sent on Discord (the owner, same day): a `.lmix` (`music_dsp::lmix`), a
      `.legatosync` (`music_core::syncmode`) and any later kind, each then opened as the same file dropped from disk is,
      through the same checks (the `.lmix` reader's size cap, unknown fields refused, settings clamped); one that writes
      to the library (a sync file) asks first, and a stranger's never brings secrets. To make it safe (the owner: "well
      secured"): https only, those exact hosts, no redirect off them, a size cap per kind and a timeout, the kind taken
      from the content (image bytes, the file's own format), never from the name alone, nothing decoded before that
      check, the `Noted` resolver, nothing sent but the request itself; a new host, so the website's privacy rows first
      (`PRIVACY`, `SERVICES` in `site/components/content.tsx`).
      Done 2026-11-18: `crates/connectors/src/discord_file.rs` (check, fetch, kind from bytes), `src-tauri/src/discord_drop.rs`
      (`discord_take`: saves the file in the cache folder), `ui/src/features/library/discordDrop.ts`, a paste / drop listener
      in `PlayerBar.tsx`; the `discordapp.net` host in `netlog.rs` (Settings › Privacy), a "Files from Discord" row in `PRIVACY`.
      NOT tried: a real Discord drag, a real expiring link, a real `.lmix` posted on Discord; the website build (it stops on
      Next's own registry call, as before: only its tests and `tsc` ran).
      The drag may never reach the page: wry (0.57, `webview2/drag_drop.rs`) accepts file drags only and ignores a dragged
      text on Windows while Tauri's file drop is on, so a PASTE (Ctrl+V of the copied link) is the route that surely works; the
      `drop` listener is there for platforms that pass the text through. A real drag tells; if it fails, the fix is a native
      drop target in Rust (a bigger change), or an explicit "Paste a Discord link" button.
      Decided alone (2026-11-18): (1) no `.legatosync` kind: there is no drop route for one today (a sync file is one PC's file
      inside the shared folder, read by Sync Mode), so building one that writes to the library was out of scope: refused as
      "not a picture or a Legato file". (2) Attachment paths only (`/attachments/`), not avatars or emoji. (3) An explicit
      `:443` is accepted (the URL parser drops a default port), any other port refused. (4) No setting: nothing runs unless
      the user pastes or drops an exact Discord link, so no off-by-default switch; easiest to undo = delete the listener
      in `PlayerBar.tsx`. (5) A picture is only read for a share card's link (`share_read_image`), never kept as a cover.

- [ ] `M` Android: the sound sometimes crackles or sounds saturated (the owner, 2026-11-18, cause unknown to them, "maybe
      the connection"). Their answers: a YouTube song, Bluetooth earphones, the screen off or the app in the background, no
      effect on. Not reproduced. The owner's word (2026-11-18): fix the live processing so it holds up there; never
      switch it off to dodge the problem. Suspect first (read in the code, not proven): by default every YouTube song is
      listened to through Chromium's audio nodes, the phone too (`earlyEnds` on by default → `ends` in
      `player/liveSync.ts:55` → `live.js` `attach()` in listen mode: `captureStream`, an `AudioContext`, four 2048-point
      analysers and the K-weighting filters). A running context likely opens a sound output of its own, connected or
      not, beside the element's: two streams to the earphones from a background WebView, and Bluetooth (A2DP) wants
      steady buffers. Fixes to try, in order: the listening-only context rendered with no sound output
      (`new AudioContext({ sinkId: { type: 'none' } })`, Chromium 110 and later; older ones ignore the option), so the
      earphones get one stream; then the processing mode (`full`, the element muted) checked the same way. Each tried on
      the owner's phone, screen off, Bluetooth; the YouTube Music app on the same earphones tells whether Bluetooth
      alone crackles. A connection drop stalls or stops a song rather than crackling it.
      Built 2026-11-18 (NOT ticked: only the owner's phone can tell; nothing was run on Android): `live.js` makes a
      listening-only context with `sinkId: { type: 'none' }` (documented: MDN "AudioContext() constructor", Chrome blog
      "Change the destination output device in Web Audio", Chrome 110+; lore: that an unconnected context still holds an
      output stream and that a silent sink stops it; a third-party report says Chromium 154 and older give the silent sink
      the default device's parameters, 155+ paces it), the old constructor as fallback; the processing context is unchanged.
      On Android only: analysis every other tick through 4096-point analysers (half the reads, no gap). Not done: suspending
      the context when paused (`tick` detaches a context that is not running, a resume needs a gesture: too risky blind).
      Plainly: `on` in `liveSync.ts` is `process || coverPulse || viz || meter`, so `ends` alone never turns the live
      context on: the phone's listening-only context only exists with cover pulse, the visualizer or the meter on.
      To try on the phone, in order: (1) YouTube song, Bluetooth earphones, screen off, as before: no crackle = the second
      stream was it. (2) Still crackles: Settings › Sound, early song ends off (and cover pulse off), same test: no
      crackle now = the listening alone still hurts (look at the analysis next); still crackles = not the listening.
      (3) The YouTube Music app on the same earphones: crackles there too = Bluetooth alone. Not tried: `process` mode.
      2026-11-19, the owner: it is the Live Editor ("bien dû au live editor"). Decided alone: once used, `buildFx` ran
      every part all the time, even at rest (HRTF panner, one or two Freeverbs of 24 looped delays, compressor, 4x
      WaveShaper, the pitch shifter's oscillators), twice during a crossfade (two embeds, two contexts): too much for a
      throttled phone's audio thread. Now a part at rest is unwired (Chromium renders only what reaches the output): its
      input 250 ms after its fade, its feedback to 0, its output 3 s later once emptied (else it froze holding sound and
      replayed it when it came back: seen in Chromium, fixed), the drive switched at once (`wire`, `parts` in `live.js`, `wiring.test.ts`); the sound is the same
      (offline render in Chromium: all on then off = the neutral level), desktop too. NOT ticked: the cause is likely,
      not certain. To try on the phone: (1) Live Editor used on a song then reset, YouTube song, Bluetooth, screen off:
      no crackle = the idle parts were it. (2) Same with crossfade on, across a song change. (3) 8D (Space) and reverb on:
      crackles only then = those parts alone are too heavy (next: a lighter reverb on Android). (4) Speed or pitch changed.
      Fixes landed 2026-11-18/19 (390e82fe, 306de9a3, c0245823), not tried on the phone.
- [x] `M` The devices sync heard sooner on the network (the owner, 2026-11-18, from the phone: "que ça se détecte plus
      rapidement sur le réseau"). Today (`src-tauri/src/devices.rs`): listening starts 20 s after launch (`FIRST`), the
      automatic round runs every 60 s (`EVERY`) and wakes early only when a trusted device is heard for the first time
      (`heard`, the `fresh` check), not when its stamp changes; a device mDNS doesn't hear is tried at its last addresses
      every 10 minutes at most (`dv::PULL_EVERY`). Done = a change on one device reaches the other within seconds while
      both are open on the same Wi-Fi, without a flood of syncs; the wake rules tested in `crates/core` `devices.rs`.
      Done 2026-11-18: a change here wakes the round once settled (`dv::round_now`: 2 s quiet, 5 s between rounds at
      least, still every minute), the counter `Versions::changes` read every 2 s (no snapshot built for it); a trusted
      device heard with a new stamp or flag wakes it too (`Heard::wakes`). No wire or TXT change. Decided alone
      (2026-11-18): `FIRST` stays 20 s (the start is kept light), the 2/2/5 s figures are guesses. Tests: the rules and
      the counter (`cargo test -p music-core`), clippy; never tried between two real devices.
- [ ] `L` Android: the devices sync also runs while Legato is in the background (the owner, 2026-11-18: "même quand
      l'app mobile est en background et non ouverte en grand"). Today the multicast lock lives from `onCreate` to
      `onDestroy` (`MainActivity.kt`) and only playback keeps a foreground service (`PlaybackService.kt`, its Wi-Fi lock),
      so a phone in the background that plays nothing is likely frozen by Android (cached apps, Doze) and its round
      stops. Find what Android allows (a round as the app leaves the screen, a periodic job, the playback service's
      lifetime) without a permanent notification nobody asked for; tried on the emulator with the app in the background.
      Part done 2026-11-18, not tried: leaving the screen runs a round (`visibilitychange` → `devices_wake`), and the
      playback service, silent, now lingers 30 s off screen before it stops (`LINGER`, `MainActivity.leftAt`), so that
      round and the other device's answer finish before Android freezes the app; with music playing it already runs.
      Decided alone (2026-11-18): no WorkManager job or permanent notification (a sync long after leaving would need
      one); the media notification stays those 30 s as it did up to 60 s before. Not built or run here (no Android
      target nor `env.ps1` on this PC: the Kotlin is unchecked, CI builds it). To try on the phone: change a playlist,
      leave Legato at once (Home), within 30 s the PC has it; on the PC change one, the phone (off screen, silent)
      gets it only once back on screen. The page never sees `visibilitychange` on Android (`KeepVisible`): `onResume`
      and `onPause` call `window.legatoScreen` (syncmode.ts) instead, unchecked on a device.
- [x] `M` The devices sync needs no visit to the Sync screen (the owner, 2026-11-18: "qu'il ne faille pas aller exprès
      sur le truc sync, que ça se fasse automatiquement"). "Sync automatically" is on by default, but when both devices
      sync automatically only the smaller id starts (`dv::starts`), so a sleeping device (the phone in the background)
      can hold the other back; the Sync screen only refreshes the status (`Devices.tsx`, every 10 s) and "Sync now" is
      a button. Find why the owner had to go there, then fix it (for instance: the other side starts after a grace
      delay, a round as soon as the phone comes back to the screen).
      Done 2026-11-18, both: when both sync automatically, the bigger id starts too once a sync has been due here 30 s
      with nothing from the other (`dv::GRACE`, `starts`' new `waited`; a round woken then); the app back on screen
      (`visibilitychange`, `syncmode.ts`) calls `devices_wake`: a round now, and devices mDNS doesn't hear are tried at
      their last addresses at once (not 10 minutes later). Decided alone (2026-11-18): the likely cause is the phone as
      the smaller id, asleep or unheard after waking; 30 s is a guess; two syncs crossing at worst merge twice (no
      loss). No wire or TXT change. Tests: `starts` in `crates/core`; never tried between two real devices.
- [x] `S` The phone's bottom tabs follow Settings › Sidebar entries (the owner, 2026-11-19, from the phone: "le truc pour
      éditer les onglets ne marche pas sur mobile, par exemple cacher l'icône radio de la sidebar"). Done 2026-11-19:
      `phoneTabs(hiddenNav)` in `tabLogic.ts` (tested) hides Home, Mixes or Radio as the sidebar does; Search and Your
      library can't be hidden, so a tab is always left. Decided alone (2026-11-19): `hiddenNav` travels with Sync Mode as
      before, so an entry hidden on the PC hides the phone's tab too (easiest undo: add it to the per-device settings).
      Never seen on a phone.
- [x] `L` Live sync between trusted devices (the owner, 2026-11-19, from the phone: "ajoute le sync en direct mais que avec
      les device trustés, en mode tu fais un truc et sync instantanée entre les devices, et bien sûr comme d'hab pour le
      réseau ce qui circule c'est full encrypté et bien sécurisé"). First thoughts: trusted (paired) devices only, over the
      sealed session they already open (pair key in the keychain, nothing in clear but mDNS's stamp). Today's rounds
      (75cb8db3) already run seconds after a change, but each swaps a whole snapshot (big on a large library): "instant"
      means a held connection per trusted device on the same network that carries only the change made (a like, a
      playlist edit, a setting), merged by the same rules, with the snapshot round kept as the catch-up. Battery: an idle
      held socket costs little, but a phone in the background is frozen anyway (a2cf7431), so live there only while open.
      Done 2026-11-19 (d26cfb8b..): `docs/sync-mode.md` › Live. Decided alone (2026-11-19): no held connection, one short
      sealed connection per change (idle = nothing, `AT_ONCE` never held); the round still follows a few seconds later
      (both stamps move, so it would take a stamp swap in the ack to skip it: a follow-up if bandwidth matters); live
      only after the first swap since start. Never tried between two real devices: latency, two PCs or a phone + a PC
      crossing changes, Windows' firewall on the push.
- [x] `S` A launch played by itself (the owner, 2026-11-19, from the phone: "des fois l'app mobile quand tu l'ouvres ça
      reprend tout seul la musique alors que quand t'as quitté l'app elle était stoppée, et je crois que ça fait la même
      pour PC"). With "Resume playback on launch" on, the saved pause was dropped (`paused: exact && …`): only the first
      launch after an update kept it. Now `resumeAs` (session.ts, tested): back paused when left paused, playing when left
      playing. Ruled out: sync merges and pickups never play (a click), the YouTube embed honours `hold`; Android's and
      Windows' media controls play only on a button (a headset may send one when it connects). Decided alone
      (2026-11-19): the setting's words stay (still true). Not tried on a phone.
- [x] `S` Android: an update downloads in the background, with a progress notification (the owner, 2026-11-19, from the
      phone: "il faudra faire en sorte que l'app mobile puisse download l'update en background et aussi fasse une notif en
      mode mise à jour taille/taille avec une progress bar avec l'API Android"). 8e343126: `UpdateService.kt`, a data sync
      foreground service only while the APK comes (its own channel), "<done> / <total> MB" and a determinate bar moved at
      most once a second from `mobile/update.rs`; done, a notification with the bar full whose tap opens Legato, where
      the installer waits (ApkInstall, as before); failed, nothing left. The download, its checks and the installed-app
      rule unchanged. Decided alone (2026-11-19): the version and numbers only in it (no words, so no locale to keep),
      and Android 13's notification permission asked at the first download (it never was: the music's notification
      gains too). To try on the phone: none of the Kotlin or the phone's Rust could be built here (no Android target).
- [x] `M` Daily mixes and « For right now » follow what you play now (the owner, 2026-11-19, from the phone: « dans tout ça j'écoute aucune musique quotidiennement, et dans les autres mix des fois y a des musiques que oui j'ai beaucoup écoutées mais que je n'écoute plus du tout maintenant »). Ticked 2026-11-19 with b6d42173. Cause: the daily mixes were seeded by the sum of every song's score, where playlist, saved and like bonuses never age, so old likes won, and the right-now mixes added every past play at that hour (30-day half-life). Fix: daily mixes are seeded only by artists with at least 2 full plays in the last 60 days; likes and playlists only link and rank. Never heard in the app.
- [x] `S` The phone's Settings › About squeezed each description into a column one or two words wide beside its controls (the owner, 2026-11-19, from the phone: « problème de texte »). Fixed by one row style for every settings page, `ui/src/features/settings/rowStyle.ts`, `1736bbf5`: in a narrow pane the row wraps, the words keep at least 55 % and the controls go under them. The diagnostics report now says System / WebView off Windows (`838c7ad5`). Not seen on a phone yet.
- [x] `M` Much fuller diagnostics for debugging (the owner, 2026-11-19: « 5Mo de size max »). Today `diagnostics.log` already rotates to 5 MB at most (5 files × 1 MB, `crates/core/src/diag.rs`), and Copy diagnostics takes only the 20 latest problems and 12 latest events (`src-tauri/src/diag.rs` lines 185-186). Plan: log much more (Live Editor and audio facts, Android lifecycle, devices sync, update download sizes, network failures, UI stalls, error stacks); Copy diagnostics carries every recent line up to about 200 KB (Android's clipboard and a chat paste can't take 5 MB); a button saves the whole log (5 MB at most) to a file. For Opus after this Beta.
  - Brief (Opus): Copy diagnostics carries the log's tail up to about 200 KB (a pure function in `crates/core`), a "Save the whole log" through `shared/files.ts`, more INFO lines.
  - [x] Slice 1 (2026-11-27): Copy diagnostics carries every recent line that fits in 200,000 bytes (`diag::tail`),
    whole lines, the oldest left out. Tests only, not tried for real (Android’s clipboard included).
    - Decided alone (2026-11-27): the 12 “Recent events” gave way to these lines, errors repeated among them; the
      report says where the older ones are only when some were left out.
  - [x] Slice 2 (2026-11-27): Settings › About › Save writes the whole log (head, then every line kept, oldest first)
    to the picked file, phone included (`diag_save`). Tests in core; neither button nor phone tried for real.
    - Decided alone (2026-11-27): the button says “Save” beside Copy and shares its “Include details” box; the file
      is named “Legato diagnostics <date>.txt” (UTC date).
  - [x] Slice 3 (2026-11-27): INFO lines for a downloaded update (version, MB), a sync that merged something (counts), the
    audio output changed, a Live Editor export. The summary tested in core; the shell lines not tried for real (the phone
    one not even compiled here).
    - Decided alone (2026-11-27): automatic device syncs log their merges too; the fallback to the default device when
      a chosen one is unplugged stays silent (the player crate has no log).
  - [x] Slice 4 (2026-11-27): a stall of 1 s or more (long tasks), a phone leaving the screen and coming back, and up to
    three stack frames on errors. Tests only, not tried for real (the long-task observer seen starting in the browser
    demo).
    - Decided alone (2026-11-27): the phone’s leaving is heard from the shell (`shared/screen.ts`), since the page never
      gets `visibilitychange` there; a switch repeated within a minute is said once.
  - Left out, as the design says: network failures as such (a failed command is already logged through its alert).
  - 2026-11-27, after review: a stall is told in whole seconds, so stalls alike are said once a minute. Test only.
- [x] `M` Screen off on the phone: our extras rest (the visualizer's analysis, our own animation and polling loops), YouTube's player untouched (the owner, 2026-11-19). Sonnet: `9dce33b9`, `306de9a3`, `cbec7f0c`. Not seen on a phone yet.
- [x] `M` The update between two songs does not seem to happen: find why (the owner, 2026-11-19: "le fameux truc de update entre deux song a pas l'air de marcher"). Opus, `f164d866`. The PC already worked; the phone now waits for the song's end; INFO lines in the log. Not tried on the phone.
- [x] `S` One « More… » per right-click menu, never two (`5ae44406`).
- [x] `S` Now Playing panel: the album line like the artist's, bold, clickable, with its cover. 2026-11-26: PC panel; typecheck and lint only, not seen in the app.
  - Decided alone (2026-11-26): no `album_info` call (it gives the year and track list, no cover: the cover is the playing song's own, nothing new asked of the network); smaller than the artists' (16 px bold) so the title and artists lead; the page opened is the one "Go to album" opens.
- [x] `S` Phone: the artist names bold with their picture, and the From line with the playlist's icon and bold name, as on the PC. 2026-11-26: the phone's Now Playing draws `ArtistLine`; the From line was already there (the phone's top bar uses the same `FromTag` since `8cb3e92e`). Not tried on a phone.
  - Decided alone (2026-11-26): the names in ink as on the PC (they were grey), the source icon stays grey; several artists wrap onto more lines; the PC's picture size (32 px); the mini player and the title above an open panel keep one plain name.
- [x] `S` Playlist icons default to a grid of 4 covers (`39122055`).
- [x] `S` « Made from songs you love » mixes take their seed song's cover (`c449f71d`).
- [x] `M` Right-click › Hide for parts of the interface (first the Now Playing panel's cards), shown again from Settings › Appearance. A live interface editor for themes comes later.
  - 2026-11-27: right-click the From tag, the source line, the lyrics peek or the next line on the PC’s Now Playing › Hide (the player’s menu stays under it); Settings › Appearance › Hidden parts › Show hidden parts. The user’s list joins the theme’s hidden `nowPlaying` parts (`withHiddenParts`). Tests; seen in the browser demo, not tried in the app.
  - Decided alone (2026-11-27): `hiddenParts` is synced as the brief says (`hiddenNav` stays per PC); only those four parts, the album line not; the phone keeps its own screen, so the row is PC only; no toast after Hide (the Settings row is the way back); not in bug reports (a list, like `hiddenNav`).
  - Brief: hideable parts of Now Playing (source readout, lyrics peek, next line, From tag) with a synced setting `hiddenParts`; a "Hide" menu item; Settings › Appearance "Show hidden parts" clears them. Pure toggle tested.
- [x] `M` Right-click an artist › Never play this artist again (radio, mixes and autoplay skip them), with a way back. 2026-11-26: song and artist menus, Settings › Playback › Auto-DJ › Artists never played; synced. Never seen. Smart shuffle isn't filtered; focus sessions not yet.
- [x] `M` Mix covers in several styles, different from one mix to the next, instead of 2×2 grids everywhere. 2026-11-26: Settings › Mixes › Mix covers › Varied, the new default (`mixes/coverStyle.ts`); tests only, not seen in the app.
  - Decided alone (2026-11-26): saved settings still on the grid (the old default, not told from a picked one) move to Varied once (v12), Single and Template stay; the tinted look is the lead cover in one flat colour taken from its song's name; numbered mixes next to each other never look alike; "Made from songs you love" keeps its seed cover under Varied; a grid with under 4 covers stays the single cover.
- [x] `S` A video titled "Title - Artist" (reupload channels) showed the two swapped (the owner, 2026-11-27).
  2026-11-27: YouTube search and pasted links turn it round when only the right side is an artist of the library, an
  edit marker after the name staying with the title (`matching::reversed_credit`); never tried in the app.
  - Decided alone (2026-11-27): "known" is the library's artists only (nothing new asked of the network); a marker
    alone doesn't turn it ("Artist - Song (slowed)" has it too), so an unknown artist stays read as before; share codes
    and song lists are left as they were; songs already saved swapped are not rewritten.
- [x] `M` Normal videos (a story web series) counted as music: rework the detection; no « Like » mix seeded from a non-music video.
  - 2026-11-27: numbered episodes and series channels in `musicness.rs`; only a song judged Music seeds a Like mix. Tests only, not tried for real.
  - Decided alone (2026-11-27): markers are S1E2, episode / épisode / episodio / folge / Ep. with a number, never a bare season or chapter (song titles), ignored on an artist’s Topic channel; “Ep. 5” alone stays a doubt (it may be a short album); an old import stored as music is taken back for “Episode 3”, not for “S2E4” alone; a series channel is told by its name (series, stories…) and only moves titles with nothing musical; radios seeding discoveries are unchanged.
  - 2026-11-27, after review: a title that says music beside the number is no episode (“Episode 2 (Official Video)”,
    “lofi mix ep. 3”), and an artist’s own channel (Topic, VEVO, artist badge) is no series. Tests only.
    - Decided alone (2026-11-27): a band named “… Stories” on a plain channel with a plain title stays a doubt (shown,
      never a Like seed).
  - Brief: episodic clues in `crates/core/src/musicness.rs` (episode markers, series channels); the Like-mix seed only from tracks judged Music, never Unsure. Tests: one per clue, and a real song titled "Part II" stays Music.
- [x] `M` A listening history page, local only (plays already feed the mixes). 2026-11-26: sidebar › History, by day, skipped marked, Reset history there too; no search. Never seen.
- [x] `M` Titles written "Title - Artist" still showed swapped ("like that - doja cat *slowed*", the owner again,
      2026-11-27).
  2026-11-27: the library's artists no longer count what only a video named (a row saved swapped vouched for itself).
  Links from song lists and share codes go the same way, an older version's code too (`turn_video_only`). In a search,
  an artist YouTube Music's catalog named since the start counts as well (`ytmusic::catalog_artist`, 20,000 at most, no
  request of its own), read once its song results are in. Saved songs only a video named, 10 minutes at most, are
  turned once (`backwardsTitles2`). Tests; not tried for real.
  - Decided alone (2026-11-27): mixes, radio, autoplay and playlist imports take YouTube Music's own artist field (no
    split, nothing to turn); a pasted link goes by the library only; an unknown channel posting "Doja Cat *slowed*"
    reads like a swapped title and turns too (the raw title isn't kept); a song of unknown length is turned; a sync
    renames no song a PC has.
- [ ] `S` Mixes' artist key for a YouTube Music upload titled "Title - Artist" (`mixes::credit` splits it on the dash
      and takes the left side): grouping, Like seeds and the artist name a mix may show; no song renamed.
- [x] `S` A video-only title saved swapped that a sync from an older PC brings after the one-time turn stays swapped:
      `turn_video_only` on the songs a merge inserts, never on one already there; the one-time turn runs once more
      (`backwardsTitles3`). Built 2026-11-28 (`f0ef47ba`), not tried for real.

## The owner's asks of 2026-11-07, evening

- [ ] `S` Android: scanning a sync QR code crashes the app right after the camera permission is accepted (Beta
      1.1.785 on their phone; the diagnostics show three restarts in a minute and no error line: a native crash). 2026-11-07: the plugin's Kotlin (tauri-plugin-barcode-scanner
      2.5.3) shows no sure cause; a Java crash now lands in the diagnostics (`MainActivity.kt` `keepCrashes`, never built
      here: no Android toolchain on this PC), so the next Beta's Copy diagnostics names it. Faster: the phone on USB with
      debugging on, `adb logcat -b crash -d` on a PC with the SDK. (to check: 8e9fb3f2 and 81f4511d show a crash in the
      diagnostics; the crash cause is still open)

## The owner's answers of 2026-11-11 (still to build)
Also settled: no push yet (they try with `pnpm dev` first); the flowing background, the new-releases section and the
classic mini player stay off by default; the web share link stays the default; permissions ahead for the next runs: yes.

## The owner's asks of 2026-11-11, night

Noted from their message, nothing built or checked yet. After the answers above, or later, by the plan's priorities.
Where a line says "reading", the owner hasn't confirmed it.

- [ ] `M` Remixes shared outside the app: a small file of ours, `.lmix` (or close, the owner's call), and its compact
      link. It holds the song's YouTube link and the mix's Live Editor presets, never the audio (no mp3: Fixed
      limits, no download). Dropped on Legato, the song plays with the Live Editor open on those presets.
      A mix of a local file is the one case where the file carries audio (the owner's word, 2026-11-11): the mp3
      itself, or a version encoded for the `.lmix`. Only for the user's own local files, never a platform's audio
      (YouTube, Spotify, Apple Music: the link only). File only, too big for a compact link. To settle before
      building: a note at export that sharing a song is the user's responsibility (their own music or rights), a
      size limit, whether a personal server's song counts as local, and the embedded audio treated as untrusted
      when opened (the Security line).
      2026-11-11, the YouTube-link form: `.lmix` (JSON: format, version, name, video id, title, artist, the Live Editor's
      `Effects`) in `music_dsp::lmix` (64 KB, unknown fields refused, the settings clamped, tested with a fuzz loop);
      `lmix_read` / `lmix_write` in the shell; dropping one on the window plays the song and opens the editor on its settings
      (`features/editor/remixFile.ts`); Live Editor's menu has "Share this mix as a file…" (a YouTube song only). Left open:
      the Windows file type (double-click on a .lmix), the local-file form that carries audio (the owner's answers first).
      2026-11-12, the compact link: `legato://remix/<base64url of the settings that differ from neutral>` (about 280
      characters), copied from the Live Editor's menu ("Copy this mix's link"), pasted anywhere or opened from the system, checked
      like a file (`lmix::from_link`, fuzzed). Decided alone (2026-11-12): the link carries no audio and no new host. Untried: a real drop, the editor's load race on a slow start (waits 5 s), the YouTube thumbnail as art.
      2026-11-18 (lot 57), the file type: a `.lmix` double-clicked in Explorer opens in Legato (or the running one) like a
      dropped file (`protocol::file_of`: absolute, that extension, not a folder; then `openRemix` → `lmix_read`). Registered
      by the installer only (`src-tauri/tauri.windows.conf.json` `fileAssociations`; its uninstaller removes it), never by
      the app; dev, e2e and bench builds don't bundle. Decided alone (2026-11-18): class `Legato.Remix`, "Legato remix",
      the exe's own icon, role left at the default (macOS only); Windows only, else Android and Linux would claim it too; no
      `.legatosync`. If the installer breaks: delete `src-tauri/tauri.windows.conf.json`. Untried: a real install,
      double-click (app closed and open), uninstall. Still open: the local file that carries audio (the owner's call).
- [ ] `M` Optional sign-in with Discord, for a profile (the owner will make a Discord bot anyway). Never required.
      First use: the share page shows who shared a playlist, their profile carried in the link so it can't be faked
      (the owner's word: encrypted in the link). Open before building: encryption alone doesn't stop a fake, a
      signature does, and a signing key shipped in the app can be taken out of it; a signature by the owner's bot
      is a server of ours (CLAUDE.md: serverless). The owner's call between an unverified profile, or their bot
      signing as an exception to that rule. Discord's OAuth for a desktop app without a secret: to check; a new
      host, so a privacy row.
      2026-11-13, the version without a bot landed (Settings › General › Discord sign-in, off by default): OAuth code +
      PKCE, no secret, scope `identify`, redirect `http://127.0.0.1:47819/callback` (Discord matches it whole, so a
      fixed port), tokens in the keychain, the profile (name + id) in the library setting `discordProfile`; the link
      carries it as version 3 (`share::Profile`), the share page and the import dialog show "shared by …" as NOT
      verified. Decided alone (2026-11-13): unverified, since a signature needs the bot (still the owner's call).
      Untried for real: the Discord page, the redirect once registered in the portal, a busy port 47819.
      Left: the bot's signature, a song card's profile.
      2026-11-13 (lot 25): the profile counts only while the keychain still holds the sign-in (`discord_login::current`: links and Settings use it, a stale one is forgotten on the way; `standing` tested).
      2026-11-13 (lot 29): Settings › Accounts shows the account as a profile card (`DiscordAccount.tsx`: the banner, else the `accent_color`, the round avatar over it, the name, Sign out; no avatar: the initial). `users/@me` also gives `avatar`, `banner`, `accent_color`; `DiscordCard` (never in a link: `Profile` is unchanged, still unverified, no e-mail) keeps the two cdn.discordapp.com addresses, built in Rust from the id and a checked hash, shown through the `art` scheme (`art.rs`: only `/avatars/` and `/banners/` on that host). Settings › Privacy has a Discord reason (discord.com, discordapp.com), the website's privacy row says it. Untried for real: a signed-in account (animated avatars show their still PNG), the card in RTL and in the dark theme on screen.
- [ ] `L` Settings reorganised (the owner, 2026-11-13: "messy").
      - [ ] `M` The remaining JSX moved into one component per group (optional).
        - Brief: split `SettingsView.tsx` into one section component per group, one commit per group, no text or id change; the catalog, search and desktop-only tests stay green.
- [x] `L` Right-click menus customised (the owner, 2026-11-13: "it fills the screen").
      - [x] `M` Every other menu wired (its items in `MENU_ITEMS`, `shaped(kind, …)`), then the customising screen (per kind: tick, reorder, Reset).
        Done 2026-11-18 (lot 59) for the long ones: the visualizer's menu is its own kind `visualizer` (11 items, none `detail`, so Standard shows what it always did) and a catalog result's menu (Add music) is the songs' (`track`, with `addToLibrary` added) so the preset and the customising screen reach both; Album and artist keep using the songs' menu. Decided alone (2026-11-18): the karaoke, cover, picture-in-picture, Live Editor, version, preset, add-on and plugin menus stay as built (3 to 7 items each, mostly the way out of their screen: a hidden "Leave" would be a trap), easiest to wire later with the same two lines. Tested by `menuItems.test.ts`; never seen in the app.
- [x] `S` Lot 51: the wrong artist picture came from a shared cache (the owner, 2026-11-15, "Strano": the photo of an Italian singer instead of the channel @StranoKHP). Cause, read in the code, not run-proven: `artist_picture` and `ytm_artist` read and write ONE cache keyed by the lower-cased name (`state.cache.artists`, 30 minutes), and `discord_artist_art` (the Rich Presence's small image) called `public_ytm().artist(&name, &[])` with NO titles, so it took the first same-named catalogue artist unchecked and `put` that page in the same cache; whoever filled the key first won, and the checked lookups then served the unchecked page, picture and top songs, without re-checking. Lot 36's wrong-artist rule (a page is kept only if its songs confirm it) had this hole: its own note says the Presence keeps the unchecked first result, and nobody saw it shared the cache. Done 2026-11-15: `Caches.presence_artists` (a second `Ttl`) holds the Presence's unchecked pages; `discord_artist_art` reads the shared cache first (a checked page is the better one) then its own, and writes ONLY its own; `artist_picture` and `ytm_artist` never read it. Pacing, the `LOOKS` limiter, the 6-hour miss and the refusal rules are untouched. Test: `an_unchecked_presence_page_is_invisible_to_the_checked_lookups` over the real `Caches` (several keys, empty, mixed case; a checked page may serve the presence, not the reverse); a separate cache makes a key function unnecessary (no shared key space). Audit: `grep` finds no other writer of `cache.artists` and no other `artist(` call with empty titles (`artist_picture` and `ytm_artist` go through `artist_page_for` with the song titles; lot 47's channel path comes from a song's own byline); `ytChannels` (lot 47) only holds channel ids read from a song's own byline, so by construction the song's. A poisoned page cannot survive a restart: `Ttl` is memory-only. NOT tried for real: the owner's real Discord presence together with Strano (the page is also only as right as the song titles sent for the check: a name whose real artist has no title in common with the library's songs still shows no page). References read: `src-tauri/src/lib.rs` (`Caches`, `discord_artist_art`, `artist_picture`), `ytm_browse.rs` (`ytm_artist`, `artist_page_for`), `crates/connectors/src/ytmusic/home.rs` (`artist`, `pick_verified`).
- [x] Lot 42, recommendation (the owner, 2026-11-14: Shuffle really shaped by the algorithm, no "Then, similar songs" switch, the best music for the user but a bounded dose of the new, many real mixes from a song they love). Design: `docs/recommendation.md` (read it first). Build in this order, one commit each, `pnpm check` green:
  - Decided alone (2026-11-14): the scoring stays in the front end (Up next and Shuffle live there) and moves to Rust only if slice 8 measures it slow; Variety is the one control (it was the user's only handle already); Shuffle is shaped whenever Smart shuffle is on (a "Smart shuffle" off keeps the plain random order, easiest undo: set `beta` to 0); explore dose 10 / 20 / 35 % with a floor above 0; every number is a first guess, never heard by ear.
  - Slice 5 done 2026-11-19 (night run): Home › "New for you" (a button above the YouTube Music shelves when they offer songs): `discovery.ts`, `radio.ts` `startDiscovery`. Decided alone (2026-11-19): a button, not a new Home section (no settings, no defaults version; easiest undo: remove `NewForYou`); the profile is the last 3 songs played; songs the library already holds are left out; shelves' playlists and albums are not opened (no new request). Slices 1 to 5 are done: 6 (the bandit) stays "later, if they fall short". Never seen in the app.
  - Slice 4 done 2026-11-19 (night run): a mix from a song also takes the top songs of 2 "Fans might also like" artists of the seed's artist (`Artist.related`, `crowd.ts` `fansOf`, `radio.ts` `startMix`). Decided alone (2026-11-19): a related artist is looked up by name unchecked (the first of that name), its 5 top songs ranked after the radios' best (place 5+, one vote); 3 extra YouTube Music requests per mix at most (the seed's artist page, 2 related), cached by Rust; not used at Up next's end. Never run against real YouTube Music; the carousel's English title is matched as it is in the fixture. Slice 5 is open.
  - Lot 65 (2026-11-18), slice 3 done: `TasteSignal.replays` and the pair-skip drop in `near` come from the same SQL pass over `plays` (`crates/core/src/history.rs`); a replay counts as a like in `taste.ts`. Decided alone: 1 replay is enough (within 24 h, last 30 days); a pair is dropped at 2 skips in 90 days; this session's replays only count after the next signals reload (every 20 listens). `cargo test -p music-core history` and clippy on that crate pass. Never felt. Slices 4 and 5 are open.
  - Lot 64 B (2026-11-18), slice 2 "Why this song" done: each pick at the end of Up next and in a mix from a song carries the ONE reason that scored it most (`pickWhy.ts`: "In 3 radios of what you played", "You often play it next to songs like these", "By an artist you play next to these songs", "Sounds like what is playing", "Something new for you"), shown after the artist in Up next like the Auto-DJ's. Decided alone: no "Played after <artist>" (the fit does not keep which queue song a link came from, naming one would be made up); easiest undo: remove the span in `UpNext.tsx`. Slices 3 to 5 are open. Never seen in the app; texts in 19 locales, machine translations (the French says vous).
  - Lot 64 A (2026-11-18): an early skip of the app's own picks steers the rest outside Shuffle too (`markPicks`, tested in `feel.test.ts`; docs/recommendation.md › In the session). Decided alone: Auto-DJ picks count as picks too; picks are remembered by id and forgotten when a new queue plays, a restored session loses them (no steering, never a wrong move). Never felt in the app.
  - Slice 1 of `docs/recommendation.md` › Slices done 2026-11-18 (lot 62): Up next's end takes the radios of the last 3 distinct YouTube songs and "Start a mix" the seed's, signed in or out, merged with `votes` (`crowd.ts`), fit's radio term x (1 + 0.5 x (votes - 1)). Slices 1 to 5 are done (details below). Untried against the real YouTube Music; the public radios' answers signed out are as the Mixes page already gets them.
  - Ticked 2026-11-18 (lot 55): the parent was left open by the clean-up while its slices shipped (git log: `dacf3cd6` taste signals, `a137385c` the score, `01475207` Shuffle, `ca2f6720` the switch gone, `74501e5d` the end of Up next, `66b542e8` Variety and the bench, `4a921e9f` the rebuild). Every number is still a first guess never heard by ear: that stays the owner's test, not a line.
  - [x] Rebuilt 2026-11-18 (the owner, 2026-11-17: Shuffle in playlists and mixes "horrible", redo it like YouTube or TikTok): `docs/recommendation.md` › top (what made it bad, each fault reproduced in `feel.test.ts`), Shuffle, In the session. Decided alone (2026-11-18): Shuffle weighs rest x marks (no play count, no artist taste), keeps each artist apart, and an early skip steers it at once; the picks multiply fit by preference (a high rating lifts a song among those that fit, no longer over them); songs heard one after the other on this PC count in the fit (`TasteSignal::near`). Easiest undo: revert the commit. Never heard by ear.
- [x] `S` Add to playlist offers the imported playlists (the owner, 2026-11-17: on the phone an imported one was never offered). Cause: the menu offered your own, the YouTube Music ones only while signed in (written on YouTube) and a Subsonic server's (`takesEdits`); signed out, as on the phone, no imported one, on the desktop too. Done 2026-11-18, the owner's word ("as if the playlist came from this device", a copy tried first and dropped): the song goes into the imported playlist itself (`Library::add_here`, table `playlist_added`, schema v23), plays by its YouTube version like the rest, stays through the service's next imports (at the newest end) and travels with Sync Mode (`PlaylistSnap.added`); only those songs come out (Remove from ›, a click on its checked row in Add to playlist), the service's own stay its, never reordered; YouTube's own likes stay out (the heart's). Untried on the phone.
- [x] `S` Now Playing's "From …" kept through a relaunch (the owner, 2026-11-17: lost each time). Cause: `resume` cleared it. Done 2026-11-18: saved with the queue (`session.ts`, the same setting on the desktop and the phone) and given back to `resume`; a resume that names none (a room, a blind test, a pick-up) still leaves no old one. A radio or a mix comes back with its label but, as before, no longer grows. Untried in the app.
- [x] `S` The phone: the YouTube video's box at the foot of Your library (the owner, 2026-11-17: far too much room). Cause: the mini player docked in the sidebar (place "In the sidebar", a desktop-only setting a phone can still hold) kept its 200 px video slot there. Done 2026-11-18: on the phone no card at all (the owner, 2026-11-18, after a slim row whose time line doubled the bar's: "nothing at all"), the video out of sight as for the floating card since 2026-11-06, Now Playing showing it. Untried on the phone. Lot 62, 2026-11-18 (the owner, with a screenshot: the card repeats the bottom bar): the 'sidebar' place is gone for everyone: `miniPlace` is `panel` | `float`, a stored 'sidebar' reads as `panel` (`theme.test.ts`), `SidebarPlayer.tsx`, its mount, its two locale texts and the choice in Settings are removed; the phone's hidden video slot comes from `MiniPlayer` (narrow = floating path). Untried in the app.
- [x] `M` Android home-screen widgets (the owner, 2026-11-13, like YouTube Music's): three, from `MediaState` only (no network, the page's cover, no secret), buttons = the notification's actions through `PlaybackService`; `Widgets.kt`, res `widget_*`.
      Polished 2026-11-19, ticked after the owner's try (« quand t'auras fait ces changements on pourra cocher »): the
      picker shows each widget with sample content (Android 12+, `previewLayout`, sample words in all 18 `strings.xml`);
      the queue rows have their covers with rounded corners; the rectangle's cover is round; the record is drawn at its
      widget's real size with a 600 px cover (it was pixelated). Commits `459fa71a`, `03fafe17`, `0ba6d547`. Kotlin never
      compiled on this PC: the release job compiles it.

- [ ] `M` Discord bot (the owner, 2026-11-13: to make later, for social features; optional, an exception to serverless that the owner validates; the application « Legato Manager » already exists, public client + loopback redirect set)
- [ ] `L` The website made beautiful (the owner: too basic today) and given documentation sections for developers
      (plugins' API, themes, the link and file formats, contributing). The design is a piece Fable may do itself (the
      owner's word).
      2026-11-13 (lot 32), looked at before touching anything: the hero at 1440 px (dark) and 375 px (light), through the built-in browser on `next dev`. It is already a product page (the headline as the picture, the real interface tilted in 3D from the demo, one download button, the privacy link, the platforms line) and holds at phone width in the light theme; no redesign was made, because a taste change nobody could judge here would only risk what works. The plan's "too basic" predates the Story and the demo. Left for the owner's eyes: the chapters below the hero, the Features block, the 18 languages' longest lines.

- [x] `S` The site's build follows only the repository documents it includes: `pages.yml`'s paths list `docs/architecture.md`, `docs/plugins.md` and `CONTRIBUTING.md` in place of `docs/**`, so notes edits don't redeploy an identical site.
  - 2026-11-27: the three `<include>`s of `site/content/docs` are the only documents read; `docs.test.ts` fails when
    the workflow’s list and them differ. Not tried for real (no push yet).
    - Decided alone (2026-11-27): the list stays written in the workflow, checked by that test.
  - 2026-11-27 (review): the root `package.json` and `pnpm-lock.yaml` are listed too (the demo is built with them).
- [x] `S` Pin one pnpm version: CI pins 10 (`check.yml`, `pages.yml`), the local install is 11; pick one and pin it in both places.
  - 2026-11-27: `package.json` `packageManager` pins pnpm 11.9.0 and every `pnpm/action-setup` step (check, pages,
    release) reads it. Both frozen installs pass offline with 11.9.0 here; not tried for real (no CI run yet).
    - Decided alone (2026-11-27): 11.9.0, the local one (lockfileVersion 9.0 is read by 9 to 11; it needs Node
      22.13 or later, which `node-version: 22` gives); `release.yml` too, as two versions would stop the action.
- [ ] `S` The FAQ label `[Docs › Plugins]` is English: translate "Docs" if the owner wants the word in every locale. (to
      check: where the FAQ label is set, not located in this pass)
- [x] `S` Bump the site's `motion` from `^14.9.0` to `^14.14.0` so it dedupes with the copy `fumadocs-ui` uses.
  - 2026-11-27: `pnpm why motion` in `site/` finds one version, 14.14.0. Site not built, not tried for real.
    - Decided alone (2026-11-27): lockfile updated offline, so nothing else moved.

## The owner's asks of 2026-11-13

- [ ] `S` Remove the rename catch-up (when every PC of the owner runs the new name): delete `src-tauri/src/rename.rs` and its call in
      `lib.rs`, the old Run entry handling in `autostart.rs` (`OLD_NAME`, `music-app.exe`), the old-install cleanup in
      `src-tauri/windows/hooks.nsh`, the old identifier in `identity.rs` (guest list), `e2e/e2e.test.ts` and `scripts/bench.test.ts`, the
      `Music App Sync` note in `CLAUDE.md` › Names; the `music-app-sync` sync label stays (see above).

## The owner's asks of 2026-11-12


## Best in class (user's ask 2026-10-30)

What a listener would get, against Riff (rootscripts/riff: Electron, yt-dlp downloads, YouTube / SoundCloud, imports
from Spotify / Apple / Deezer) and the best players overall (Spotify, Apple Music, MusicBee, Plexamp, foobar2000,
Cider). Already ours and kept as selling points: legal playback (no downloads), Tauri (light), Sync Mode between PCs,
Last.fm, Music Detector, Live Editor (10-band EQ, tempo, pitch, reverb, space), smart playlists, stats, mixes, sleep
timer, synced lyrics with offset, visualizer, themes + own CSS, plugins, Windows media panel, global shortcuts, many
languages. Rules unchanged: nothing on this list downloads, records or exports a platform's audio, and no server of ours.

Each line below is detailed (what the user sees, how, rules, effort, done when) in [ideas/](ideas/README.md).

### Roadmap (order to build in; effort S = one session, M = a few, L = many)

Pick from the top. Each milestone is one release on the Stable channel; workflow items that unblock others go first, and
a quick win from Features › High can go in any release. Milestones 0 (Groundwork), 1 (First impression) and 2 (Sound and
sight) shipped together as Stable 1.1.

| # | Milestone | What lands | Effort | Why now |
|---|---|---|---|---|
| 3 | Platforms (1.2) | Spotify private playlists and Liked Songs for free (Connect Spotify, guided copy, data export), SoundCloud links, playlists as files, import from other apps | M | The user's ask; a library that can't move is the first reason not to switch |
| 4 | Lyrics (1.3) | Word-by-word lyrics, translation, find by a line, lyrics saved into files and tapped live | M | Riff and Cider's most loved screen |
| 5 | Your own music (1.4) | ~~Jellyfin / Navidrome / Subsonic / Plex~~ (done 2026-11-06), ReplayGain, batch tag editor + MusicBrainz, ratings, column view, ListenBrainz, playlist folders | L | MusicBee / foobar / Plexamp users switch for this |
| 6 | Smart (1.5) | Local sonic analysis, song / artist radio, sweet fades, path between artists, auto-DJ, smart shuffle, Wrapped | L | What no free desktop app does without a server |
| 7 | Around the house (1.6) | ~~Phone remote~~ (done 2026-11-02), cast (DLNA / Chromecast), ~~listen together on the LAN~~ (done 2026-11-06), pick up on the other PC | L | Turns a player into a home system |
| 8 | Windows polish (1.7) | Command palette, taskbar buttons + Jump List, headphones / call pause, alarm, OBS overlay, PiP, drag from Explorer | M | Small, many, each a reason to stay |
| 9 | Everywhere (2.0) | The mobile version (Android, then iPhone: the owner's ask 2026-11-02, [ideas/mobile.md](ideas/mobile.md)), macOS and Linux builds | L | Riff's one platform lead; the owner wants Legato on the phone |

Kept apart (need the user's call or an outside step): Spotify playback paths, Spotify's web session, LLM playlists with a
user key, SoundCloud playback and search (its terms), concerts (an API's terms), trademark search.

### Against Liner (user's ask 2026-11-05: lead it on every point)

Liner (`tryliner/desktop`): Electron, Windows / macOS / Linux, an account on its server, YouTube's audio taken and
served from its own copies (never ours: CLAUDE.md). The comparison, row by row, and each line's detail:
[ideas/liner.md](ideas/liner.md). Already ahead: weight, no account or limits, privacy, the phone, languages in the app,
the visualizer, the library, the player's tools, updates. Already ours too (checked 2026-11-05): the instrumental mark,
the settings search in every language, an everywhere shortcut for picture in picture, brand channels, recent searches,
Discord's buttons, the taskbar's thumbnail buttons, issue forms.

Numbered easiest first (the owner's ask 2026-11-05: all of them, by difficulty). Built hardest first: the owner's
ask for the autonomous run of 2026-11-05 evening,
with the interface on top (U1, U2 below): ours does too much on a phone, and lacks the glow and the simplicity Liner
has (inspiration only, never its code or assets). Never copied: their playback (YouTube's audio taken, their own
copies, downloads for offline), their accounts, limits and paid plan.
      2026-11-12: while Your stations is empty the page shows "Stations to start with": the most listened of the user's country
      (`region()`: the interface's language, never an IP lookup) and of the two genres their local files' tags and listens weigh
      most (`suggest.ts`), at most three requests (`radio_suggest`); the website's row says exactly what goes (a country code, up
      to two genre words). The heart keeps one. Decided alone (2026-11-12): asked when the page opens (not on a button), once per
      visit, since the page is the radio; the region is the interface language's (Windows' own region isn't read). Never seen.
- [ ] 6. `S` A native window on Windows 11: snap layouts on our maximize button (`WM_NCHITTEST` → `HTMAXBUTTON`,
      beside `thumbbar.rs`), Windows' minimize and maximize animations.
      The owner's choice 2026-11-11: together, with the owner at the PC (not built blind).
      Left by the autonomous run (2026-11-11): WebView2's own child windows cover the title bar, so the hit test has
      to be answered there and the button's hover and click redone by hand; a mistake breaks the window's buttons for
      everyone, and it can't be tried without a screen. With the owner at the PC.
- [ ] 15. `M` SoundCloud sets and likes: set aside (the owner's word, 2026-11-07). Its API terms (§01, §03, §10.4)
      forbid rebuilding its sets on YouTube without a registered app of theirs. Today's way, untried: Tune My Music's
      CSV export through Add music › song list.
- [ ] 16. `M` Reach: left, microsoft/winget-pkgs#474341 merged by Microsoft's moderators (submitted 2026-11-07; then
      a manifest per Stable, `packaging/README.md`). Done: the website in 18 languages, README screens, Discussions; (to
      check: is winget-pkgs#474341 merged? ad435198 says submitted only)
      no Scoop (decided alone).
- [ ] 17. `L` Listening rooms over the internet, no server of ours: sealed control messages through a public relay (the
      owner's call), or the LAN. Takes in "Listen together on the local network".
      - [x] The internet half (the owner's choice 2026-11-07): WebRTC data channels, offers sealed with the room code
        and swapped once through public Nostr relays (relay.damus.io, nos.lol), Cloudflare's STUN for each side's public
        address; no TURN, so two strict NATs can't meet. The relays see the room's random id, both public IPs and the
        times, never songs, names or reactions: a privacy row says so.
        Decided alone (2026-11-25): WebRTC runs in Rust, not in the WebView. The WebView's RTCPeerConnection would be network
        from the front end (CLAUDE.md), its sockets past `Noted` and Settings › Privacy. `str0m` 0.26 (MIT/Apache, sans-IO: our
        own UDP socket, so every host is noted; pure-Rust crypto, `rust-crypto`; only its certificate maker builds aws-lc, a C
        library) builds on Windows (tried 2026-11-25); webrtc-rs was larger and mid-rewrite (0.17 frozen, 0.20 not stable).
        Desktop only at first (aws-lc on the Android NDK untried). The room's own wire (SPAKE2 on the code, sealed frames,
        tries counted) runs unchanged inside the data channel, so only the transport is new. Offers are sealed with a key from
        the room's id and code; the relays see a hash of the id, never the id.
        2026-11-25, slice 1: the meeting through Nostr (`connectors/src/roomsignal.rs`): ephemeral signed events, offer and
        answer sealed, a refusal or 30 s without an answer ends it; tested on a mock relay (WebSocket), never a real one.
        2026-11-25, slice 2 (first half): the room's wire runs over any stream (`rooms::Stream`, `Host::take`, `join_over`):
        same handshake, code and tries; tested over an in-memory pipe. Each side's public address from Cloudflare's STUN
        (`stun.rs`, tested on a local UDP socket). Slice 2 done: the str0m data channel as that stream (`roomlink.rs`
        `dial`/`accept`, candidates sent with the offer, no trickle; 20 s to open or "Couldn’t reach the room"); a real
        room runs over it on 127.0.0.1 (welcome, code, a song). Never tried across two networks or through a NAT.
        2026-11-26, slices 3 and 4: "Invite over the internet" in the room's view, the invite link (`legato://room?c=…&r=…`)
        pasted or opened then Join; the host listens on both relays (`roommeet.rs`, a new code listens again); the privacy
        row and Settings › Privacy name the relays and STUN. Desktop only. Decided alone (2026-11-26): an opened invite
        never joins by itself; the guest asks through the first relay that answers. Never seen, never tried across two
        networks.
- [ ] 19. `L` A macOS build, unsigned first as Liner's (signing: the owner's Apple Developer Program): WKWebView, Now
      Playing, the menu bar. Built by GitHub's Actions on a macOS runner (the owner's word, 2026-11-07). Features › High's
      macOS and Linux line takes it; Linux is the `L` line "Linux for both versions" below (the former item 18, folded in 2026-11-27).

### Platforms (milestone 3, user's ask 2026-10-31)

What the services allow, read on 2026-10-31 (specs in [ideas/catch-up.md](ideas/catch-up.md)):

- **Spotify, official API:** reads a user's own playlists, but a Development Mode app needs a Premium owner, so never free
  ([migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)).
- **Spotify, web session:** the token needs the TOTP hidden in the web player's code. Rebuilding it defeats a technical
  protection: never. Reading what the signed-in player shows needs neither that token nor that secret (each row has its
  title, artists, album, duration and track link: checked on a public playlist, signed out, 25 rows drawn of 50, so it
  scrolls). But Spotify's [User Guidelines](https://www.spotify.com/us/legal/user-guidelines/) ban scraping, by hand or
  automated, and a breach can close the account (no such ban found in a search). The user took that risk on 2026-10-31,
  and the app says it before the first connection.
- **SoundCloud:** its [API terms](https://developers.soundcloud.com/docs/api/terms-of-use) bar scraping, require a
  registered app, and bar a playback experience that mixes its content with other services'. Its site terms restrict
  players used to build a streaming service (read as a summary only: the full page didn't load). So links imported
  as metadata first; playback and search are the user's call.

- [ ] `S` Connect Spotify, not tried yet: playlists inside a library folder, a collapsed library column, an expired
      session, the window covering Legato while it reads (Cancel in the toast may be behind it), a list with local files.
- [ ] `S` per service: public playlist links from more services (TIDAL, Qobuz, Amazon Music), same flow as Deezer. Nothing
      checked yet.

### Features, sorted (user's ask 2026-10-31)

Three groups, easiest first inside each. The tag is the effort from the specs (a guess where there's no spec yet).
Importance is a first estimate (2026-10-31), the user moves lines as they like.

- **High**: most listeners would notice it, or it removes a reason not to switch.
- **Medium**: a real gain for one kind of listener.
- **Low**: niche or fun, for later.

**High**
- [ ] `L` A Lite build next to the full one (owner's ask 2026-11-25, his words as recorded: "deux versions… une version light
      faite automatiquement à la compilation… l'essentiel de l'app, focus sur l'optimisation"; maybe more variants later).
      Built from the same code by a build flag (cargo feature + a Vite define), never a fork. Its own app: name "Legato Lite",
      identifier `app.legato.lite`, its own data, keychain entries and update feed (the full app's `latest.json` URL
      unchanged). Cut: advanced sound (Live Editor, effects, Music Detector, visualizer, loudness meter; the simple EQ and
      levelling stay), connected extras (Discord, OBS overlay, Stream Deck, phone remote, listening rooms, plugins), modes
      and games (blind test, karaoke, living-room TV, podcasts, audiobooks). Built and attached on every Beta and Stable,
      same release. The owner's decisions of 2026-11-27: the design below is validated; Lite is for small Linux machines
      and small phones, so it also costs less RAM and CPU, not only fewer pages: one YouTube player and no crossfade,
      animations off by default, fewer background tasks, a smaller image cache, each cut measured. Platforms in this
      order: Windows, Android, Linux (the Linux line below).
  - The full app measured (Opus, 2026-11-27), dev build (debug Rust, Vite's dev server, its own 1 799-song library),
    Ryzen 5 5500 (12 threads), only windows with no cargo/rustc running in any sample. Paused on screen: 364 MB
    (app 48, WebView2 316, of it the page's renderer 224), 4.7 % of a core. Playing YouTube (two embeds, the next one
    cued): 490 MB (renderers 307, GPU 84), 26 % of a core (GPU 12, renderers 10). The release reference is the last
    `docs/performance.md` row (local files): 149 / 183 / 57 MB paused / playing / tray, 0.1 / 2.5 / 0.1 % of the PC.
  - Target, Lite against full on the same PC and day: release (`pnpm bench`) RAM ≤ 120 MB paused, ≤ 150 MB playing,
    ≤ 50 MB after 10 min in the tray; CPU ≤ 0.1 % of the PC paused, ≤ 1.5 % playing (18 % of a core). YouTube
    playing (the dev-build way above, until the bench plays YouTube): ≤ 400 MB and ≤ 20 % of a core.
  - Design (Opus, 2026-11-26):
    - Rust: feature `lite` in `src-tauri/Cargo.toml` next to `e2e`. `crates/plugins` (rquickjs), the rooms' internet half
      (connectors feature `rooms`: str0m and relays) and the Music Detector (player feature) become optional. Their commands
      sit behind `#[cfg(not(feature = "lite"))]` in `generate_handler`, and `deferred.rs` starts the same way.
    - UI: Vite define `__LITE__`, read in one `shared/edition.ts`. `pages.ts` points cut pages at a stub. Sidebar, menus,
      the settings catalog and `keys.ts` read the same table. Setting keys stay in the type and in `sanitize`, so cut
      values pass through untouched.
    - Tauri: overlay `src-tauri/tauri.lite.conf.json` (like `tauri.bench.conf.json`) with productName "Legato Lite",
      identifier `app.legato.lite` (Android `app.legato.lite.mobile`), its own NSIS and Run entry names, and the feed
      `…/releases/latest/download/latest-lite.json`. Beta feed: `…/download/beta/latest-lite.json` (`update.rs`
      `BETA_ENDPOINT` per edition). The full app's `latest.json` URL stays unchanged. Same signing key.
    - Identity: `identity::installed()` accepts `app.legato.desktop` or `app.legato.lite`. `rename.rs`, the old Run entry
      and `hooks.nsh` are compiled out for Lite.
    - Sync Mode: same snapshot and `_legato._tcp`; Lite never deletes what it doesn't show.
    - Decided during the 2026-11-26 run: both editions can be installed side by side, and Lite doesn't register
      `legato://` when the full app is there. Windows first, then Android, then Linux. CI time roughly doubles at each release
      (accepted). The site offers a second download, "Legato Lite: the essentials, lighter on your PC" (through the
      site's i18n).
    - Slices: 1 edition plumbing (feature, overlay, define, `edition.ts`, identity, feeds, `pnpm build:lite`); 2 UI cut
      table and a test that every cut entry is absent when lite; 3 Rust cfgs and optional deps (`cargo check --features
      lite` in CI); 4 `release.yml` second build and feed; 5 `pnpm bench` Lite vs full in `docs/performance.md`; 6 docs
      and the site's download line.
    - [x] Slice 1, 2026-11-27 (`9fd3a288`, `761b1626`): feature `lite`, `tauri.lite.conf.json` (and `.lite.dev` for
      `pnpm dev:lite`), `INSTALLED` per edition in `identity.rs`, `latest-lite.json` for Stable and Beta,
      `rename.rs` and the old Run entry compiled out, `__LITE__` and `shared/edition.ts` (read by nothing yet),
      `pnpm build:lite`. Tests in both editions, `cargo check` / clippy of the Lite (now `--no-default-features --features lite`); not tried for real (no Lite
      built or installed).
      - Decided alone (2026-11-27): a Lite exe built without its overlay is a guest (exact identifier per edition); Lite
        never registered `legato://` at first (replaced by the review fixes below); no installer
        hooks of the full app nor `.lmix` association in Lite; its Run entry is "Legato Lite".
    - [x] Slice 2, 2026-11-27: what Lite cuts is one table (`ui/src/shared/liteCuts.ts`): pages stubbed in `pages.ts`,
      shortcuts, settings rows and search, right-click items, start-up modules, plus the few buttons no table reaches
      (`offered`). Saved settings, shortcuts and menu layouts keep their values. `liteCuts.test.ts` checks each entry is
      absent in Lite and nothing is in the full app. Not tried for real (no Lite run).
      - Decided alone (2026-11-27): the loudness meter goes with the visualizer; "effects" are the Live Editor's, so Lite
        plays songs without their saved edits (kept in the library), the per-output equalizer, Volume levelling and
        Adaptive Sound staying; a dropped or pasted remix is ignored; Stream Deck goes with the phone remote and the
        overlay; the cut pages' chunks are still in the bundle (never loaded); "Process YouTube's sound" still names the
        Live Editor in its text.
    - [x] Slice 3, 2026-11-27: the full app's own parts are `legato`'s default feature `full` (plugins, the connectors'
      `rooms`, the player's `detector`); Lite builds `--no-default-features --features lite` (`pnpm dev:lite` /
      `build:lite`, `release.yml`'s `lite` job), registering none of the cut commands (plugins, rooms, Music Detector,
      Live Editor exports and edits, remix files, visualizer, remote and overlay, podcasts, Discord sign-in);
      `check.yml`'s Windows job runs clippy on it; `lite` with `full` is a compile error. `cargo check` and clippy `--all-targets` pass in both editions: 616 crates in
      the full app, 526 in Lite. Not tried for real (no Lite built, installed or run).
      - Decided alone (2026-11-27): `default = ["full"]`, since Cargo can't drop a dependency for a feature that is on;
        the equalizer, levelling and the engine's meters keep their commands; the rooms' local half and the remote's
        server stay in the code, unregistered (links.rs paces searches through rooms, cast uses the remote's address);
        the AudD token still syncs in Lite (`secrets::AUDD_TOKEN`).
    - [x] Slice 4, 2026-11-27: `release.yml` jobs `lite` (its own Windows runner beside `release` and `android`:
      `tauri build --features lite --bundles nsis -- --no-default-features`, the same updater key, `latest-lite.json` written in tauri-action's
      shape) and `lite-attach` (installer, `.sig` and `latest-lite.json` on `vX.Y.Z`, then `latest-lite.json` on `beta`);
      `scripts/promote.mjs` carries `latest-lite.json` to Stable when the release has one; the site's download picker
      takes only `Legato_…-setup.exe`. Not tried for real (no release run yet); the site's Lite download is slice 6.
      - Decided alone (2026-11-27): a runner of its own rather than a second build in `release` (that one would delay
        the APK's attach and turn the full app's job red); Lite installer `Legato.Lite_X.Y.Z_x64-setup.exe`, NSIS only;
        a beta without the Lite's file is still promoted (warned), Lite PCs on Stable then find no update until the next.
      - Decided alone (2026-11-27): a failed Lite leaves the release run red though the full Beta shipped; kept as the
        signal (no `continue-on-error`, which would hide it). `lite` stops at 45 min (the one `release` group waits for
        it); a re-run of an older run never takes Beta's `latest-lite.json` back.
    - [x] Slice 1 review fixes, 2026-11-27: Lite registers `legato://` when it is alone, the full app takes it over from
      an exe in a "Legato Lite" folder (`protocol::keeps`), Lite's `windows/hooks-lite.nsh` deletes the key only when it
      names `$INSTDIR`; `identity::PRODUCT` names the Run entry, tray, mixer (its own group), window title and error box;
      feature-free tests hold the Lite config's nulls, hooks and identifier. Not tried for real.
    - [x] Slice 6, 2026-11-27: the site's download section links Legato Lite's installer beside the full one, with what
      it leaves out (18 languages), only when the latest release carries it; README and `docs/development.md` say it.
      Privacy rows unchanged (Lite reaches nothing new). Not tried for real (no Lite installed, the site not built).
      - Decided alone (2026-11-27): the Stable release only, like the full download, so the link shows once a Stable
        has the Lite (not before); no memory or speed claim in its text, nothing measured yet.
    - Android slice, still open: its own overlay over `tauri.android.conf.json` (`app.legato.lite.mobile`, not the
      `app.legato.lite` this one would give) and an APK feed per edition (`crates/connectors/src/apk.rs` `BETA` is the
      full app's `latest.json`: a Lite phone would be offered the full APK).
    - Lighter slices (2026-11-27), each with its number before and after in `docs/performance.md`: 7 one YouTube
      embed (PlayerBar's second `YouTubeFrame` never made; crossfade absent from Settings › Playback, its value kept as
      is in the settings file); 8 `motion` off in Lite's own defaults (the user can turn it on); 9 fewer background
      tasks (`deferred.rs` / `deferred.ts` start only what Lite shows; the hidden page suspended sooner than
      `background.rs`'s 5 minutes); 10 a smaller cover cache (`ArtCache::new(…, 500 << 20)` and `coverCacheMb`'s
      default: 250 MB in Lite). Lite's defaults apply only where the user never chose, as with `DEFAULTS_VERSION`.
    - [x] Slice 7, 2026-11-27: built, not measured yet (the bench waits for the owner). Lite cues no next song and
      fades none into the next (local files too), so `PlayerBar` only ever draws one `YouTubeFrame`; the Fades rows
      about song changes are gone from Lite's settings, saved values kept; Sweet fades' analysis never starts. Not
      tried in a Lite.
      - Decided alone (2026-11-27): the fade on pause a full app saved still applies, its row hidden with the rest.
    - [x] Slice 8, 2026-11-27: built, not measured yet (the bench waits for the owner). Lite's defaults: Animations
      and Background motion off, only where nothing is saved; with animations off the glass over a picture is an
      opaque panel without `backdrop-filter`. Home's flowing background reads Background motion. Not tried in a Lite.
      - Decided alone (2026-11-27): the opaque glass hangs on the `.still` class, so it applies in the full app too and
        under Windows' own animations-off.
- [ ] `L` Linux for both versions, full and Lite (the owner, 2026-11-27), after Windows and Android. Folds in the former
      item 18: WebKitGTK, the MPRIS media panel, the tray, PipeWire for the Detector; built by GitHub's Actions (the owner's
      word, 2026-11-07); local tries in WSL or a VM once the owner sets one up (a system change, theirs).
      Designed 2026-11-27 (Opus), not built (below). WebKitGTK instead of WebView2: check the YouTube embed there first
      (codecs, autoplay, the shield's hooks and `live.js`), then the keychain (Secret Service), the tray, Open at startup,
      packaging (AppImage or .deb) and its update feeds.
      - Base: the former item 18 (folded in above). The CI already compiles the non-Windows paths (macOS job), so Linux = those paths plus
        GTK. Both editions are one job (Lite = the same cfgs minus its cuts). Targets: WebKitGTK 4.1 (Ubuntu 22.04+,
        Debian 12+), x86_64 and aarch64 (small Linux machines, Raspberry Pi and the like).
      - Risk 1, to clear before anything: the YouTube embed on WebKitGTK.
        - Codecs: YouTube goes through MSE (VP9/AV1/H.264 with Opus/AAC); WebKitGTK decodes through GStreamer, with the
          distribution's plugins (Fedora ships without H.264 by default). The AppImage needs `bundleMediaFramework: true`
          (GStreamer inside, a bigger image); the .deb depends on `gstreamer1.0-plugins-good`, `-bad` and `gstreamer1.0-libav`.
        - Origin: the page comes from `tauri://localhost`, and YouTube refuses an embed without a valid origin or referrer
          (errors 150/153). Measure first; any workaround stays within the rules (the official embed, never extracted audio).
        - Autoplay: WebKit's policy (`WebKitWebsitePolicies`, autoplay allowed for the main view). `live.js`: WebAudio
          inside the YouTube frame, scripts in every frame (wry injects them with `WebKitUserScript`): to check.
          Rendering: on Nvidia/Wayland `WEBKIT_DISABLE_DMABUF_RENDERER` may be needed; hardware decoding varies (CPU cost
          on small machines: measure for the Lite).
      - Windows-only today, so a Linux twin or absence (no fake buttons: a table of what is missing in `shared/platform.ts`,
        the UI hides it):
        - `media.rs` (SMTC, media keys) → MPRIS (`mpris-server` on zbus, already in Cargo.lock through keyring). Media keys
          go through MPRIS, never registered, as on Windows. `session.rs` (other apps' players, the Detector's first
          layer) → an MPRIS list over D-Bus; cut in the Lite anyway.
        - `secrets.rs` keyring → Secret Service (gnome-keyring, KWallet; the keyring feature already pulls it in). Without
          a daemon: never a plain-text file. Settings says so; connections are not kept (a session keyutils fallback to
          study, lost at reboot).
        - `shield.rs` (WebView2's `WebResourceRequested`) → `WebKitUserContentFilter` (compiled rules) to block, and the
          `resource-load-started` signal to note each host (CLAUDE.md: every window noted; Settings › Privacy). Required
          before any release: the privacy lines must stay true. `cookies_for_url` (ytm, spotify_web, web_reader): wry
          handles it on Linux (WebKitCookieManager); a real test is needed.
        - Absent: `background.rs` `browser_args`, `webview_watch.rs`, `ytwatch.rs`, `thumbbar.rs`, `jumplist.rs`,
          `speech.rs` (WinRT: voice search disappears; no Web Speech in WebKitGTK), `unplug.rs`, `window_place.rs`
          (Wayland forbids placement: size only), `rename.rs` (Linux never had the old name).
        - `mixer.rs` (mixer label) → `PULSE_PROP="application.name=Legato[ Lite]"` set before the window; web processes
          inherit it, PipeWire reads it.
        - `autostart.rs` (HKCU Run) → `~/.config/autostart/<id>.desktop` (the `$APPIMAGE` path for the AppImage).
          `protocol.rs` (`legato://` in the registry) → `MimeType=x-scheme-handler/legato` in the .desktop (the .deb
          installs it; the AppImage registers it at first launch via `xdg-mime`). Both for the installed app only
          (`identity::installed()`).
        - Global shortcuts: the plugin works under X11 only; under Wayland they are absent and Settings says so. Tray:
          libayatana-appindicator, menu only (no left click on Linux). GNOME without an extension has no tray, so
          `closeToTray` is off by default when no tray is seen; otherwise closing would hide the app with no way back.
        - Native player: cpal → ALSA (PipeWire through its ALSA layer), already tested in CI (ALSA headers). Discord IPC →
          the Unix socket `$XDG_RUNTIME_DIR/discord-ipc-0` (cut in the Lite). Device name (`devices.rs`) → host name.
      - Packages and updates: AppImage (the only format Tauri's updater updates) + .deb (no apt repository of ours, no
        server: the app says "new version, download it" instead of installing; `update.rs` knows the install type). No
        .rpm or Flatpak in v1 (Flathub builds by a third party: decide later). `latest.json` gains `linux-x86_64` and
        `linux-aarch64` (tauri-action adds them; older Windows versions ignore them). `latest-lite.json`: the `lite` job's
        script merges the platforms. `promote.mjs` unchanged (`withNotes` already requires url and signature everywhere).
        Same signing key.
      - CI: check.yml's Linux job builds only the crates today (apt WebKitGTK is too slow). Add `cargo clippy -p legato`
        (full and Lite) on Linux with an apt cache, only when Rust changes (the existing `scope`). release.yml: a `linux`
        job as a matrix (ubuntu-22.04 and ubuntu-22.04-arm, the base glibc), full and Lite, attached to the same release
        as the APK; a failure does not block Windows.
      - Slices (S = 1, M = 2, L = 3), 15 points. Order: 0, then 1, then 2-3-4 in any order, then 5-6-7. After the Windows
        and Android Lite (the owner's decision).
        0 `M` [x] Trial, built 2026-11-28 (`1374f868`, `ce87dc3e`), not tried for real: the owner has not run the AppImage. The shell built in CI, a debug AppImage as an artifact. The owner runs it (WSLg or a VM, their own
          setup): the embed plays, `live.js` runs, the Google sign-in, `cookies_for_url`. Go on or stop there.
        1 `M` [x] Built 2026-11-28 (`5950c1fd`, `d2101957`, `ad105d23`, `e6f2409e`): the table of what is missing in the UI, clippy Linux in CI (green), Linux told by the build. Not tried for real.
        2 `M` [x] Built 2026-11-28, not tried for real: MPRIS (`media/linux.rs`, written on zbus, no new crate) and
          `session.rs` on Linux. To read at the first .deb: the `.desktop` file's name (MPRIS `DesktopEntry`).
        3 `M` Secret Service (a message when there is no daemon), tray / `closeToTray`, XDG autostart, `legato://`,
          single instance (D-Bus), `PULSE_PROP`.
        4 `L` WebKitGTK shield (filter + host list) and its rule tests.
        5 `M` Linux release job x86_64 + aarch64, AppImage + .deb, both editions, the feed and the .deb case in `update.rs`.
        6 `S` Site: Linux downloads per edition (today the choice only takes `Legato_…-setup.exe`), privacy lines, docs
          (architecture, development: apt dependencies, CONTRIBUTING › Releasing).
        7 `S` Measure the Lite on a small aarch64 machine (RAM, CPU while playing) against the Windows target.
      - To decide alone (2026-11-27, Opus): AppImage + .deb only; no plain text without a keyring; no global shortcuts under
        Wayland; aarch64 from the first release.
      - Not tried for real: everything. There is no Linux on the PC used for the design; the embed, codecs, MPRIS, tray and
        Secret Service are seen only in slice 0, on the owner's machine.
- [ ] `L+` Mobile version, well optimised, the Rust code reused (the owner's ask 2026-11-02): Tauri 2's Android target
      with the same crates and `ui/`, Android first, iPhone after. Spec, seven phases, what stays desktop-only and the
      owner's calls (Android SDK / NDK on this PC, a phone, GitHub or Play Store, YouTube sign-in in a WebView):
      [ideas/mobile.md](ideas/mobile.md). Phase 1, the phone layout in `ui/`, done 2026-11-02; phase 2 needs the owner's
      Android tools.
      The owner's ask of 2026-11-02: the mobile app working completely, synced with the PCs over Wi-Fi both ways, then
      a Beta with the APK; Android first; YouTube signed out on the phone, the library from the PC by sync.
  - [ ] iPhone: not for now (the owner's word, 2026-11-07); later, their signing choice (Apple Developer Program, or an
        unsigned .ipa).
- [ ] `S` + `M` Connect Spotify on the phone (the owner, 2026-11-28). Today the phone's card only opens a data export
      file (`SpotifyConnect.tsx`: no Connect on `phoneApp`; the Exportify window and Spotify's page need a second
      webview with our script, which Android doesn't give). S: an "Open Exportify" button that opens exportify.net in
      the phone's browser, the export saved, then picked by the existing file import (an Exportify file is read
      already); the privacy row already names Exportify. M: the user's own client ID (the desktop's app-key path,
      playlist scopes only), signed in through the browser with PKCE and a `legato://` redirect (Android deep link), the
      same Rust import. The page-reading path stays desktop only.
  - [x] S, 2026-11-28, not tried on a phone: the phone's card has `Open Exportify` (`EXPORTIFY` in `shared/links.ts`,
        Tauri's opener), a line saying to export there then come back, and `Choose the Exportify file…` (the existing
        `SpotifyFile`). Test: `SpotifyConnect.test.ts`.
  - [x] `S` The website's Connect Spotify privacy row says what differs on the phone (browser, file left where it is),
        2026-11-28.

**Medium**
- [ ] `S` Community: GitHub Discussions (on since 2026-11-07, with the "good first issue" label) linked from About, a
      showcase of themes on the website.
      2026-11-11: Settings > About > Community opens the Discussions. Left: the website's showcase of themes (it
      needs themes to show: the owner's or the first shared ones).
- [ ] `S-M` Watch-page player: hide YouTube's own playlist panel (its RDMM "My Mix") and stop its autoplay into a Mix
      (`crates/shield/src/watch.js`).
      Left by the autopilot (2026-11-05): `watch.js` already hides the column the panel sits in (`#secondary`, `#below`)
      and pauses at the end; what's left needs a real watch page, behind YouTube's cookie choice in a new profile.
- [x] `M` Lyrics translation in the panel (a service sends text: add the website's privacy row first).
      Owner's call (2026-11-01): which service gets the lyrics (the user's own DeepL or Google key, a LibreTranslate
      server); Windows gives apps no offline translator. The panel side is small once that's chosen.
      2026-11-13: built on MyMemory (`connectors/translate.rs`, no key, 500 bytes a request, ~5 000 characters a day per address
      without an email), behind Settings › Playback › Translate lyrics (off by default): a "Translate…" button on the lyrics'
      source line, a box that says what goes where, and the words leave only after "Send and translate"; the result shows
      each line over its translation in the box, never kept. The site's Lyrics privacy row says it. Decided alone
      (2026-11-13): MyMemory, because it is the one free service with no key and no account of ours; its daily quota fits a
      few songs a day, so a user's own DeepL key or a LibreTranslate server stays a possible later swap (one file). Tested with
      mockito only (chunks, quota, refusal, shape), never against the real service. Left: the translation under the lines
      inside the panel itself (it shows in the box), a language other than the interface's.
      2026-11-18 (lot 61): the translation the user asked for now shows under each sung line in the lyrics panel (a smaller row, in the interface's language, this song only, kept in memory by `translated.ts`; the lines are matched by `alignTranslation`, tested: breaks, empty lines, a short or long answer, a repeated chorus). Nothing new is sent (the same box and "Send and translate"). Left: Karaoke (its fixed seats would need a layout of their own), a language other than the interface's. Decided alone (2026-11-18): no new setting (it appears only after the user's own Translate…), a line the service returns unchanged gets no row. Not tried in the app: the glide after the rows change line heights (the effect re-measures when the translation arrives, from the lot 52 recipe).
      2026-11-19 (night run), the two things left: Karaoke shows the translation the user asked for as a smaller row under each line (`Karaoke.tsx`, the same `underFor` as the panel), and the box has a "Translate into" list of the app's languages, the interface's by default (`TranslateLyrics.tsx`; a translation now shows for its song in whatever language was asked). Decided alone: Karaoke only shows, the Translate… button stays in the panel. Never seen in the app (the Karaoke layout with rows, MyMemory in another language).
- [x] `M` Equalizer presets per output device (headphones vs speakers).
      Skipped 2026-11-12 (not for this run): the engine only knows the default output device (`output.rs`), no name and no change event,
      so per-device presets need platform code (a device-change watch on WASAPI, then the same on the other systems); AutoEQ profiles
      are parametric filters from a large dataset to map onto the 10-band graphic EQ, a data and licence choice. For Opus and the owner.
      2026-11-27: the preset per output had shipped on 2026-11-13 (`8fc31212`, behind a setting, “Output devices” below);
      a test that it survives a restart and that an unknown output keeps the current equalizer. Not tried for real (no
      real headset). Limit: a change of the default output made in Windows is not seen, only a pick in the player’s menu.
      Decided alone (2026-11-27): AutoEQ profiles moved to their own line below; the preset stays keyed by the output’s
      name, on this PC, never logged: a stable id (cpal’s) needs the player to list and pick outputs by id, more than
      picking a preset.
- [ ] `S` AutoEQ profiles for known headphones (for the owner: the data licence to check first).
      Their parametric filters would also have to be mapped onto the 10-band graphic equalizer.
      The owner's word, 2026-11-27: "check the data licence yourself; integrate only if it allows a free public app,
      else drop the line and tell the owner".
- [x] `M` Credits and artist pages: who wrote / produced (MusicBrainz), a short bio (Wikipedia), links out.
      Ticked 2026-11-18 (audit): everything the line names shipped: the links (`MusicBrainz::artist_links`), Credits (`eae99997`), the bio (`afb764fd`), YouTube Music's About (`71d4c9bb`). What is left is a try against the real services (Check live).
      2026-11-12, the links out only: an artist's page has "Find links on MusicBrainz" (a click, two requests a second apart, the
      name only; `MusicBrainz::artist_links`: the artist by exact name with a score of 90, then its url relations, http(s) of 8
      kinds, 12 at most), opened in the browser; the website's "Artist links" privacy row. Untried against the real MusicBrainz: the answers' shape is from their docs. 2026-11-12, who wrote / produced: a song's
      "Credits…" (any song: library or not) opens a dialog that asks MusicBrainz as it opens (the recording by title, artist and length,
      then its relations: two requests; producer, composer, lyricist, writer, arranger, mix, engineer, mastering, conductor,
      voices and instruments, 40 at most, grouped by role); the website's "Song credits" row. Decided alone (2026-11-12): opening the
      dialog is the click, so no request leaves before it.
      2026-11-12, the bio: once the links are shown and one is a Wikipedia page, "Short bio" (a click) asks that page for its
      opening paragraph (`wikipedia.rs`, one new host family: the article's own `xx.wikipedia.org`, address checked first), shown with
      "From Wikipedia, under CC BY-SA" linking to the article; the website's "Artist links" row says so. Untried against the real
      Wikipedia (mock tests only). Decided alone (2026-11-12): on a click, never on opening the page.
- [x] `M` Sweet fades (Plexamp): crossfade length picked per pair from the songs' ends (loudness, silence, tempo).
      Ticked 2026-11-18 (audit): tempo (`9f1a1fed`), the ends' loudness and silence (`7b87b623`), the next song really coming (`ef27f850`) shipped; only hearing it on real songs is left (the owner's ear).
      2026-11-13, by tempo: Settings › Playback › Sweet fades (off by default): `sweet.ts` `sweetSeconds(a, b, base)` picks each
      pair's fade out and fade in from the library's `bpm` (whole phrases of 8 beats when the tempos are within 4%, half and
      double time counted; the set seconds within 12%; at most 3 s beyond; unknown tempo or no fade: unchanged), `songFade`
      and the fade in of a song that starts on its own use it. Tested as a pure function only. Left: silence and loudness at
      the ends (the player knows them only after a song has played; they need the local analysis to store them per song).
      Decided alone (2026-11-13): tempo first, because it is the one signal the library already holds per song.
      2026-11-13 (lot 27), the ends: for local songs the earlier measures (`song_ends`, cached silences and loudness only, nothing
      decoded) join the tempo: a loudness gap over 6 dB stretches the fade up to half again, a song ending in 3 s of silence
      or more gets a 2 s fade out (`sweet.ts` `sweetFade`, fed by `sweetData.ts` / `sweetLoad.ts`). Tested on made-up numbers;
      the songs not yet measured (never played) use the tempo only. Decided alone: the silence rule shortens rather than
      lengthens, because the song already fades itself out there.
      2026-11-13, not started (decided alone): the fade is applied in three places (`songFade`, `playAt`'s `fadeIn`, the
      engine's own crossfade for files), and a per-pair length wants to be heard on real songs, not built blind at night.
      (Left by the autopilot (2026-11-05): a song's end is only known measured (local files, Skip silence on) or
      heard once (a video, `ends.ts`), its tempo not at all; the overlap is the player's most fixed code, and a
      length picked per pair needs an ear to tune: with the roadmap's Sonic analysis, or with the owner listening.)
- [ ] `M` Long YouTube mixes and DJ sets split by their chapters (or timestamps in the description / pinned comment):
      each part a song in Up next, skip within the video; Music Detector names unlabelled parts on request.
      2026-11-13, the chapters: Settings › Playback › Chapters of long YouTube videos (off by default; a video of 15 minutes or
      more that plays asks YouTube's own `next` call, `ytweb::chapters`: its chapter markers, else the timestamps of its
      description, `core/chapters::from_text`) fills the same Chapters menu the audiobooks use. Tested on made-up answers and
      descriptions only (mockito), never on a real video. Left: each part as its own row in Up next, the pinned comment (a
      separate continuation call), Music Detector naming unlabelled parts.
      2026-11-18 (lot 56), each part as its own row of Up next: done (`videoParts.ts`, `splitIntoParts` / `followPart` in
      `store.ts`, tested on made-up chapters). Decided alone (2026-11-18):
      - A part is a queue row over the same video (`part: { startMs, endMs }`, a row of its own outside the library like a
        recommendation, `remoteTrack` keyed by its start); times stay the video's everywhere, so the progress bar shows the
        whole video and a seek there stays in it. Why: the fades, the overlap, Skip silence, SponsorBlock and the resume
        all read the video's time; a time per part would touch each of them.
      - The music reaching the next part only moves the row along (index, title, a new playId): no seek, no fade, the set
        plays on as one. Next / Previous / a part picked in Up next seek the same embed (`playAt`, its start). Why: a DJ
        set is continuous; a seek at each part would cut it.
      - A part's end is as exact as YouTube's time reports (the watch page's once a second, the embed's about as often):
        it only matters when what follows is not the next part (taken out of Up next, Repeat one, another song), where up
        to about a second of the next part can be heard. The IFrame API's `endSeconds` stops the video, which would cut
        the gliding parts. A part followed by another song ends with a cut, not a crossfade (the overlap times the video).
      - Shuffle and an early skip's steering keep a video's parts together and in order (`keepParts`); taken-out parts stay
        out. Only the playing video is split, once its answer comes (the setting on, 2 chapters or more).
      - Plays and ratings: the parts count none; the video counts once, its listen running from its start until a part is
        picked by hand (the parts gliding on do not end it), so a whole set heard is one full play, not 30. Edits saved
        for the library video do not apply while it plays split (its parts key by the video, `songKey`).
      Not tried: a real long mix, a real Google answer (the owner: turn the setting on, play a DJ set with chapters, let a
      part end, press Next / Previous, take a part out of Up next, shuffle, quit and reopen the app mid-set).
      (to check: chapters of a long video landed (742e088f, 79c0979d); timestamps and the pinned comment not located)
- [x] `M` Output devices: switch from the player bar, remember per device (volume, EQ preset).
      Ticked 2026-11-18 (audit): the switch, volume per device (`ca26c14c`) and EQ per device (`8fc31212`, `a5618b3d`) shipped; a device-change event is left (WASAPI watch: needs a real device).
      2026-11-13 (lot 27), EQ per device: Settings › Playback › Equalizer per output device (off by default) adds "Equalizer for this
      output" to the player's menu: one of the built-in presets per output device (this PC's, `deviceEq.ts`), whose bands are
      added to the song's own Live Editor edit (`withDeviceEq`, tested) on the one path that already pushes effects to the
      engine and to YouTube's player (`liveSync.ts`). Not heard on a real headset; the device change itself is only seen when
      picked in the player's menu.
      2026-11-13, the switch: the player's menu has Output device (shown with two devices or more; System default, then the system's list,
      the picked one checked), `Command::SetDevice` moves what plays like the unplug `Reopen` does (same place, paused or not), the pick
      is kept on this PC (`outputDevice`, applied at launch; a device gone falls back to the default). No setting: the entry only
      appears when there is a choice. Never tried with real devices. 2026-11-13, volume per device landed (Settings › Playback › Volume per output device,
      off by default; `volumePerDevice.ts`, the volume set on a device picked here comes back when it is picked again, this PC's, 50 devices; Windows' own
      default changing is not seen). Left: EQ preset per device (skipped for now), a change event (the list is asked when the menu opens).
- [ ] `M` Right-to-left languages (Arabic, Hebrew: mirrored layout) and community translations (Weblate), more languages.
      2026-11-13 (lot 27): the layout mirrors with `dir`: the shell and every shared component outside the player use logical
      sides (ms- me- ps- pe- start- end- text-start rounded-s border-s; `i18n/rtl.test.ts` fails on a physical one), the
      page's `dir` follows the language (`isRtl`: ar, he), arrows and carets turn (`shared/ui/directional.tsx`, Phosphor's
      `mirrored`), and the player bar and the player's pages (`features/player`, `features/viz`) keep their sides on purpose
      (media controls, visualizers, the time axis do not mirror). Arabic and Hebrew are in the picker (`locales/ar.ts`,
      `he.ts`, all 2 516 texts, plural forms limited to the one / other pair the code asks for): MACHINE TRANSLATIONS, written
      by the model that built the app, to be reviewed by native speakers, which Weblate would make possible (not set up).
      Not seen on a screen: the mirrored layout (a physical offset in a style attribute, a canvas, or an absolute position
      in the player's pages may still sit on the wrong side), nor the Arabic and Hebrew text in the interface. The website
      stays in its 18 languages.
- [ ] `L` Cast: DLNA / UPnP speakers and Chromecast for local files and personal servers.
      2026-11-13, DLNA / UPnP for local files: Settings › Playback › Cast to speakers (off by default) adds "Cast to speakers…" to
      the player's menu: a box lists the renderers that answer an SSDP search (`connectors/dlna.rs`), one click plays the song
      on one (SetAVTransportURI, Play, then Pause / Play / Stop and a seek by SOAP) and pauses it here. The renderer pulls the
      file from a one-file server this PC starts on its private address (`src-tauri/src/cast.rs`: random token in the path,
      GET and HEAD with ranges, private peers only, one cast at a time, stopped by Stop casting). Every description or control
      address that is not a private one is refused. Tested on made-up answers, a fake renderer (mockito) and the file server
      over loopback; never with a real speaker or TV (their quirks are the unknown: protocolInfo, DIDL, seek support).
      Left: Chromecast (its own protocol), songs of personal servers and the queue (one song at a time), a volume control,
      the renderer's position (the box does not follow it), the PC's firewall prompt on first use (Windows asks).
- [ ] `L` Sonic analysis, ours and local: features (tempo, key, energy, brightness, mood) computed from local files, and
      from what plays live for streams (the meter already listens; measured, not extracted), stored per song. Feeds
      "similar songs", song radio, sweet fades, the path between artists (Plexamp's Sonic Analysis needs a server).
      Skipped 2026-11-13 (night), the tempo-only slice: a tempo found by decoding every local file (onset autocorrelation) is minutes of CPU on a
      big library and its right answer (octave errors, half and double time) can only be judged by ear against known songs; the tags'
      BPM already feed Mixes and the metronome. Better with the owner's ear on a test set.
      2026-11-13, the tempo-only slice landed anyway (the owner's wider mandate), behind Settings › Playback › Estimate tempo (off by
      default): `music_player::tempo` (onset curve of the first 90 s at 200 a second, autocorrelation 60-180 BPM, a pull toward
      120 against double and half readings, no answer for silence, noise or a clip under 12 s; click tracks 75-170 BPM read within
      2), a few files at a time off the UI thread (`src-tauri/src/tempo.rs`, 5 at most per call, one call every 15 s while songs
      wait, then every half hour, first one 2 minutes after launch), answers kept by file and modified time in the library
      setting `tempoGuesses` (no schema change), filling only EMPTY tempo, never over a tag. Decided alone (2026-11-13): tempo
      only, estimates share the BPM column with tags (no marker), octave errors accepted until an ear checks real songs. Never
      heard on real songs; energy, key, mood and the similarity feeds are left. 2026-11-13 (lot 25): the answers are kept in memory and written back every 10 calls and at the end of a run, no longer whole on every call.
      2026-11-13 (lot 26), the key: `music_player::key` (pitch-class energy by Goertzel from C2 to B6 on 30 s brought down to 11 kHz,
      Krumhansl-Kessler major and minor profiles in 12 rotations, no answer for noise, silence, a clip under 8 s or a close tie;
      triad progressions in C and in Am read right, noise and silence read none) fills an EMPTY key (written "C", "Am", "F#m" as
      tags do) in the same scan, same setting (its text now says "tempo or key"); the kept answers carry the key too (older
      ones still read, and are decoded once more). Real music is the unknown: the thresholds (0.55 match, 0.03 margin, 0.15
      spread) were set on made-up chords. Left: energy, brightness, mood, and the similarity feeds.

**Low**
- [ ] `M` Concerts near the user from followed artists (a public API with no account; privacy row).
- [x] `M` Audiobooks from local files (m4b chapters, resume per book, speed, sleep at chapter end), apart from music.
      2026-11-12, one half, resume per book (the line stays open): a song of 20 minutes or more, a file of this PC or of a personal
      server, is picked up where it was left: its place is kept every 10 s and when paused (this PC's storage, not synced), the
      song starts there when played again, and a notice says so with "Start over" (`resumeLong.ts`, `resumePoints.ts`); near
      either end the place is dropped, 200 songs at most. Left: m4b chapters (a container parser in Rust), a speed kept per
      book (the Live Editor has speed), the books apart from music (a page). Decided alone (2026-11-12): local and server
      files only (a YouTube video has no stable place), 20 minutes as the line. Never tried on a screen or by ear.
      2026-11-13, m4b chapters and sleep at chapter end: a library `.m4b` / `.m4a` / `.mp4` with a Nero `chpl` chapter list (what ffmpeg
      and mp4v2 write) gets a "Chapters" submenu in the player's menu (go to one, the playing one checked) and "End of this
      chapter" in the sleep timer (`core/chapters.rs` reads the `moov` box only; `track_chapters`; `player/chapters.ts`). Not
      read: QuickTime text-track chapters (Audible and iTunes books may use them) and ID3 `CHAP` of mp3s: those show none.
      Never tried on a real book. Left open: speed kept per book (the Live Editor saves its speed per song already, when
      switched on), the books apart from music (a page).
      2026-11-13, the books apart from music: Settings › General › Audiobooks (off) adds Audiobooks to the app menu: a page of the library's long
      files (tagged audiobook / spoken word at 10 minutes and more, or two hours and more; this PC's or a server's), longest first, with where each
      was left and the time left (`books/books.ts`, the resume points of `resumeLong.ts`). Decided alone (2026-11-13): the books are still in
      Songs too (hiding them there would change a list people know). Never seen on a screen.
      2026-11-13, a speed per book: 1, 1.25, 1.5, 2 on each book of the page (this PC, `books/speed.ts`); the book starts at it through the
      Live Editor's tempo (pitch kept) unless the song has an edit or a draft of its own (`editor.ts` `bookEffects`); the one playing moves at once.
      2026-11-13, the other chapter forms: QuickTime chapter tracks (the text track a `tref/chap` points to, read from its sample
      table: Apple's and Audible's books) when a file has no `chpl`, and the `CHAP` frames of an mp3's ID3v2.3 / v2.4 tag (title
      from `TIT2`, any text encoding); `.mp3` now asks too. No new dependency (`core/chapters.rs`). Tested on files built in the
      tests only, never on a real book of either kind; a QuickTime track with an unusual layout (chapters in the audio file's own
      sample description, text in UTF-16 without a mark) shows none.
      2026-11-27, apart from music: with Audiobooks on, a book (a local or server file: `.m4b`, in a folder marked in
      Accounts › Local files, two hours and more, or tagged as one and ten minutes) is judged not music
      (`core/audiobooks.rs`, the one rule): out of Songs, mixes, radio, the blind test, Like seeds, stats and Your week,
      and not in the hidden videos fold. Chapters, resume, speed, sleep at chapter end and the page already shipped (above).
      Not tried for real.
      Decided alone (2026-11-27): only with Audiobooks on (off, nothing changes; replaces “books are still in Songs too”);
      “It’s music” brings a file back; the marked folders are this PC’s (not synced).
      2026-11-27 (review): length alone (two hours and more) lists a file on the page and leaves it in the music (a DJ
      set, an opera, a sleep track); only `.m4b`, a marked folder or a book genre take it out. A book’s row has the song’s
      right-click menu (“It’s music” brings it back).
- [x] `S` Audiobooks: an `.m4a` / `.mp4` with chapters is not a book by that alone (needs the chapters read at the scan
      and kept in the library).
  - 2026-11-27: the scan counts an `.m4a`'s chapters (schema v26, `tracks.chapters`, migration tested on a v25
    library): two or more and ten minutes make it a book. Tested on built files only, not tried for real.
    - Decided alone (2026-11-27): two chapters and ten minutes at least (a marked song or a short one is no book);
      `.mp4` is left, since folder scans don't take video containers.
  - 2026-11-27: Albums, Artists, the sidebar's lists of both, Home and search no longer list books out of the music
    (`withoutBooks`). Not tried for real.
    - Decided alone (2026-11-27): only those books leave these lists; videos that aren't music stay there as before
      (Songs' filter would have taken them too). A book's own album and artist pages still show it.
  - 2026-11-27: found, folder scans never took `.m4b` files (so no local one was ever a book): they are audio now, Cast
    serves them. Not tried on a real book.
  - 2026-11-27 (review): an `.m4b` is judged not music whatever the setting; with Audiobooks off it is in no list (a
    playlist holding it still shows it).
    - Decided alone (2026-11-27): nowhere rather than through search only: it is what users had before scans took
      `.m4b`, and one condition in `mark_books` undoes it.
- [ ] `M` Stream Deck plugin and an Xbox Game Bar widget (play / skip / like / now playing) over the local hotkeys.
  2026-11-13: Stream Deck done as `integrations/streamdeck` (`docs/streamdeck.md`): play / pause, next, previous, now
  playing, over the phone remote's local routes; logic tested, never loaded by a real Stream Deck. 2026-11-19: its like
  key (`POST /key?k=like`, the same secret and private addresses as every key, POST only; the interface toggles the
  heart of what plays, never during a blind test), tested in `logic.test.mjs`, `remote.rs`, `media.test.ts`. Left: the
  Xbox Game Bar widget (a UWP package, nothing here could build or load it).
      (to check: the Stream Deck part landed (6d3d84f7, 09badb2f); the Xbox Game Bar widget not located)
- [x] `L` A theme file alone can change the app's whole layout, A to Z (owner's ask 2026-11-26): not only colours and CSS, the arrangement of every surface (sidebar, player bar, pages, panels). To design first: what the file may say (a layout schema read by the shell, not raw code), how `BRAND_GUARD` and the right-click menus survive, how a broken file falls back to the default look.
  - Further (owner, 2026-11-26): a theme may also bring extra features with reactive code (JS or similar), always checked by Rust. Lead to weigh: the theme's script runs like a plugin (`crates/plugins`: rquickjs sandbox, permissions approved by the user and checked in Rust, no secrets, files or raw IPC, `docs/plugins.md`); the layout file binds to data the shell exposes (now playing, queue, lyrics…) instead of the script touching the DOM.
  - Owner (2026-11-26): no theme scripts in v1; after v1, a theme may name a plugin installed on its own (the usual
    permission review) whose panel goes into the layout. The setting "Let themes arrange the app" is on by default,
    with a warning when importing a theme that changes the layout. PC only in v1. v1 also covers the inside of pages
    (headers, columns, sections), not only the regions and bars.
  - Design (2026-11-26). File: an optional `layout` key in the theme JSON (`Theme`, `.theme` files already keep any
    key through `themefile::pack/unpack`), data only, never code or HTML: `{ v, regions, sizes, hidden, parts, pages }`.
    Fixed regions `top, left, right, bottom` around `main` (always the page); fixed surface ids the shell owns
    (`brand, topbar, sidebar, sidePanel, playerBar`); sizes clamped to the existing limits; unknown keys and ids
    dropped; a surface not named keeps its default place (the `sanitizeHome` rule). `LAYOUT_API = 1`, additions only
    within a version, like `manifest::API`; a newer `v` ignores the layout whole (colours and CSS still apply) and the
    theme card says it needs a newer Legato. No `layout` = `DEFAULT_LAYOUT`, today's tree: CSS themes unchanged.
    Under 640 px the phone layout stays.
  - Validation: a pure TS module `ui/src/shared/theme/layout.ts` (`sanitizeLayout`, `resolveLayout`), called from
    `sanitizeTheme`, never importing `app/settings`. Not Rust: a layout grants access to nothing, it only moves the
    shell's own components; Rust stays the boundary for code. Forced rules: `main` and `brand` always shown, the
    sidebar and the top bar never both hidden.
  - Brand and menus: the brand mark (`data-brand`, now inside the top bar in `App.tsx`) becomes its own surface,
    never hidden, and `BRAND_GUARD` is unchanged. Menus belong to components, not places: each surface keeps its
    `onMenu` wherever it is drawn, `ContextMenuHost` stays outside the layout, and a layout never adds or removes
    menu items (the `menuLayout` setting does).
  - Ways back no layout can remove: Ctrl+Comma, right-click › "Default layout" (fallback menu, while a layout is on),
    the setting. A region or page part that throws drops the layout for this run, with a toast.
  - Import warning: in both import paths (Theme Studio's Import, a `.theme` dropped on the window), when the setting
    is on and the layout differs from the default. A dialog in the app's own look: "This theme rearranges Legato",
    the changes listed (a pure `layoutSummary`, at most 6 lines), how to go back; Use its layout / Colours only
    (imported without `layout`) / Cancel. Themes arriving through Sync Mode were warned about on the other PC. No
    `DEFAULTS_VERSION` bump: the setting is a new key, and nothing changes on screen until a theme with a layout is
    imported (no preset carries one); a preset shipping one later bumps it then.
  - Page parts: choices that are already settings ride the theme's `look` (applied when the theme is picked, the
    user's to change after): `columns`, `density`, `listCovers` already, and Home's order (`homeSections` added to
    `LOOK_KEYS`), so the user's own reordering wins. The frame of each page is layout-only (`pages`), applied live:
    one pure table `PAGE_PARTS` (each part `fixed` or not: a fixed part moves but never hides), a hook
    `usePageParts(page)` in its own file, the page drawing its existing blocks in that order. Reordered in React,
    never with CSS `order` (keyboard and screen readers follow; one exception, the player bar: shown above the page by
    its flex order while it stays last in the document, because its YouTube frames must never move, so the keyboard
    reaches it after the page). A hidden part's actions stay in the page's More and right-click. The shared `PageHeader` takes `pages.header` (art start / end / top / none, its size clamped, kicker
    and sub, actions beside or below). Column order: `pages.lists.columns` over `COLUMNS`, Title and Artist first,
    the heart and Time last; which columns show stays the user's `columns`. Pages in order: album, playlist, artist;
    Songs, Albums, Artists; Home (its frame; its sections through `look`); Now Playing on the PC. Other pages get the
    shared header in v1, their own parts later as additions.
  - Fixed whatever the layout: Settings and Add-ons whole (the way back; the permission review looks like the app's
    own), dialogs, menus, toasts, the welcome, Karaoke, the mini player, the connect wizard, the phone, and each page's
    main list or grid.
  - Rules for every slice: whole-word names, one job per function, comments for the why; `layout.ts` tested in
    `layout.test.ts`; no IPC command, ts-rs type or host added (no `add-connector`); every new text through `tr` in
    every locale file. Slices 1-5 first, 6-11 in any order after, 12 before the website says anything.
  - [x] `M` 1. Core `layout.ts`: types, `LAYOUT_API`, `DEFAULT_LAYOUT`, `sanitizeLayout`, `resolveLayout` with the
    forced rules, `Theme.layout` kept by `sanitizeTheme`. Tests: `layout.test.ts` (unknown ids, duplicates, newer `v`,
    clamps, forced rules, default = today's order), `theme.test.ts` (no layout unchanged, a layout round-trips).
    2026-11-26: done; pure, not tried for real (nothing draws it in this slice).
    - Decided alone (2026-11-26): each surface fits some sides only (sidebar and side panel left or right, player bar
      top or bottom, top bar top only: it holds the window's buttons and the search list opens under it); the side
      panel is 260 to 420 px (the sidebar limits moved to `layout.ts`); a newer version's layout is kept as it came up
      to 8 000 characters (above, its version only), so a save or a sync from an older app doesn't lose it; an unnamed
      logo goes with the top bar.
  - [x] `M` 2. The shell drawn from the resolved layout, and the setting (on). Tests: a pure `layoutRegions`, the
    default in today's order, the setting's sanitize and search entry. Skills: `add-setting` (new key, default true,
    no `DEFAULTS_VERSION` bump, synced), i18n. 2026-11-26: done (`themeLayouts`, Appearance › Theme); tests only,
    never seen with a layout in the app.
    - Decided alone (2026-11-26): the player bar never moves in the page (a moved video frame reloads), a flex order
      shows it above, so the keyboard still reaches it last; hidden, it stays mounted at no height (YouTube's player and
      the engine's polling live there); a hidden top bar keeps the logo, the search (review: nothing else searches),
      Settings, the window's buttons and the drag area (nothing else closes the window) and shows whole over Now Playing; a layout's size fixes the width (no resize
      handle); with no side panel the mini player floats and its buttons open Now Playing; the row is PC only and part of
      Reset appearance; a newer layout's theme card says it needs a newer Legato.
  - [x] `S` 3. The brand as its own surface, never hidden. Tests: a table of hostile layouts keeps it; `css.test.ts`
    unchanged. 2026-11-26: done (`Brand` in `App.tsx`); never seen elsewhere than in the top bar.
    - Decided alone (2026-11-26): the logo leads the top bar when it stands just before it, and always while Now
      Playing is up (it covers the other places); elsewhere it is its own small block at its place in the region.
  - [x] `M` 4. The import warning: `layoutSummary`, `withoutLayout` (pure), the dialog in both import paths. Tests:
    summary lines per difference, capped; Colours only drops `layout`; no question without a layout or with the
    setting off. Skills: i18n. 2026-11-26: done (`themeLayoutImport.ts`); the dialog and moved layouts seen in the
    browser demo (invented data), no file imported in the app.
    - Decided alone (2026-11-26): "Paste a theme" asks too; a dropped file keeps its first question ("Use the theme?")
      before this one; nothing asked on the phone, the layout kept for the PC (review); the dialog names Settings (Ctrl+,) only, not
      right-click › Default layout, which slice 5 adds (its words to extend then); six changes listed, then "And more".
  - [x] `S` 5. Ways back: "Default layout" in the fallback menu; a throwing region or part drops the layout + toast.
    Tests: the entry only while a layout is on; the boundary drops it. Skills: i18n. Review of 4: the import warning's
    text gains « right-click › Default layout » in every locale file. 2026-11-26: done (`LayoutBoundary`, `appMenu`);
    tests only, the entry and a throwing part never tried in the app.
    - Decided alone (2026-11-26): "Default layout" turns the setting off (the theme keeps its layout, one switch brings
      it back); the entry has no menu id, so the menu settings can't fold or hide it; a part that throws drops the
      layout until the app restarts; thrown under the app's own arrangement it goes to the root error screen as before.
  - [x] `M` 6. The bars' parts: player bar, top bar, sidebar (order, hidden, each hidden part still in More). Tests:
    per-surface part sanitize. 2026-11-26: done; moved parts, the three More menus and "Default layout" seen in the
    browser demo (invented data), never in the app.
    - Decided alone (2026-11-26): the file says `parts: { playerBar | topbar | sidebar: { order, hidden } }`; parts
      move only inside their container (player bar: song, center, actions; transport, progress; room, sleep, lyrics,
      Up next, volume, More, full screen. Top bar: Back/Forward, search, Offline, Add-ons. Sidebar: entries, library);
      hideable only what stays reachable (transport, room, sleep, lyrics, Up next, volume, full screen; Back/Forward,
      Add-ons; the sidebar's entries): the song, the progress bar, More, the search, Offline and the library only
      move; the top bar gets a More beside Settings when it hides something (a hidden top bar too), the library's
      header one for hidden entries; the warning says it in one line.
  - [x] `M` 7. The shared page header (`pages.header` in `PageHeader`). Tests: a pure `headerLayout` (clamps, unknown
    values dropped, phone ignored). 2026-11-26: done (a `PageLayout` context from the shell); tests only, not seen in
    this commit.
    - Decided alone (2026-11-26): `{ art, artSize, kicker, sub, actions }`, art 120 to 320 px and only on pages with
      art (the art redrawn at that size); Settings and Add-ons keep their own header; Spotify's attribution moved to a
      `notice` line a theme can't leave out; the summary says it in one line.
  - [x] `M` 8. `PAGE_PARTS`, `usePageParts`, the album, playlist and artist pages. Tests: per-page sanitize (fixed
    parts never hidden, unknown dropped, new parts at their default place). 2026-11-26: done for album and artist;
    the playlist page has only its list under the header, so no parts yet (its header follows `pages.header`). Seen in
    the browser demo (invented data, one album: "More by" never seen moved), never in the app.
    - Decided alone (2026-11-26): the header stays first (`pages.header` arranges it; its band bleeds into the pane's
      top); album: songs (fixed) and More by the artist; artist: most played, Top songs, discography, About, links,
      YouTube shelves, the hideable ones being discography, About and the shelves (links have no menu elsewhere); an
      unnamed part follows its usual neighbor; `usePageParts` reads the shell's context, not the settings.
  - [x] `M` 9. Songs, Albums, Artists, and column order in `TrackTable`. Tests: column order resolve (Title and Artist
    first, the heart and Time last, the user's set kept).
    2026-11-27: done; list and toolbar moved in the browser demo (invented data), never in the app.
    - Decided alone (2026-11-27): Songs (toolbar, column browser, list), Albums and Artists (toolbar, list): all fixed,
      they only move; `pages.lists.columns` orders every songs list's columns except Time (last, after the heart), an
      unnamed column keeping its usual neighbor; the warning says each change in one line.
  - [x] `S` 10. Home's frame parts, `homeSections` in `LOOK_KEYS`. Tests: `sanitizeLook` keeps a theme's Home order,
    picking the theme writes it, the user's later order wins.
    2026-11-27: done; tests only, not seen.
    - Decided alone (2026-11-27): Home's frame is the chips and the sections, both only moving; a theme's Home order
      is written when the theme is picked, except the switch of a section that sends something (new releases): the
      user's stays, a theme never turns it on; an older Legato drops a theme's `homeSections` when it saves it.
  - [x] `M` 11. Now Playing's parts on the PC (cover side, the title block's order, the controls row). Tests: parts
    resolve for its blocks.
    2026-11-27: done; seen in the browser demo (invented data), never in the app.
    - Decided alone (2026-11-27): `pages.nowPlayingColumns` (cover, words: the cover's side), `pages.nowPlaying` (the
      title block: only from, album, source line, lyrics peek and next hide, each reachable otherwise) and
      `pages.nowPlayingControls` (the buttons right of the transport, order only); the phone keeps its own screen.
  - [x] `S` 12. `.theme` export and import keep `layout`; docs (`docs/design.md`, the theme help, the parts per page);
    the website copy ("Make it look like yours", `site/components/content.tsx` and its locales). Tests: a
    `themefile.rs` round-trip with a `layout` key. Review of 1-4: the docs say that a layout from a newer version, or
    imported while the setting was off, starts to apply later (an update, the setting turned on) without the question.
    Review of 7-8: the theme docs say that hidden blocks are hidden content, not lost actions (an artist's discography,
    an album's "More by": the page's own way to releases outside the library).
    Review of 9-11: the docs say an older Legato rewriting the themes drops a theme's Home order (`look.homeSections`).
    2026-11-27: done (`themefile.rs` round trip, `docs/design.md` › Theme layout, the website's theme card in every
    site language); no file exported or imported in the app, the website not built.
    - Decided alone (2026-11-27): the website says it now (the feature is on by default): one clause, "and where the
      parts of the app go"; no in-app theme help exists, the format is documented in the design doc.
  - [x] `M` 13. After v1: a theme's named plugin as surface `plugin:<id>`, placed only if that plugin is installed,
    enabled and has `ui`, drawn with the existing `PluginPanel`. Tests: placement drop rules.
    2026-11-27: done (`withPluginPanels`, `features/plugins/PluginColumn.tsx`, loaded on demand); tests, seen in the browser demo with an invented plugin, not tried for real.
    - Decided alone (2026-11-27): left or right only, two panels at most, 300 px wide, away in a narrow window; "enabled" is the plugin turned on with `ui` granted, running or not; the layout stays version 1 (an older Legato ignores the surface and drops it when it rewrites the themes); the warning says one line, without the plugin’s name; right-click on the column: the plugin’s menu and Default layout.
  - Not tried for real anywhere: right-to-left with regions and parts, a moved sidebar with the library open wide.
  - 2026-11-27: slices 1 to 13 landed. Not tried for real: no theme with a layout was ever loaded in the installed app.
    - Decided alone (2026-11-27): ticked on the v1 the owner set (no theme scripts; a plugin named by a theme only
      puts its panel in a column).
- [ ] `L` Theme code: a theme's own script acts on and changes the interface as much as it can, in a sandbox nothing
      leaves; only `data-brand` (logo, legal notices) always shows (the owner's ask, 2026-11-27, after layout v1).
      Design: Opus, 2026-11-27 (report-inbox "Conception thèmes JS").
  - Engine: the theme's `script` block `{ api, permissions, code }` runs as a plugin of its own kind in
    `crates/plugins` (rquickjs, own thread, 64 MB, 1 s a run, 3 strikes), id `theme.<theme id>`. Rust checks every call
    against a theme-only table (`THEME_METHODS`): no `net.fetch`, `library:write`, `history:read`, `discord:presence`,
    `editor`, files, secrets or raw IPC, whatever the theme asks. A theme asking `network:*` is refused at parse.
  - API, UI route, data only: `theme.style(css)`, `theme.vars({ --x })` (30 a second, latest only), `theme.classes(surface,
    names)` on the shell's fixed surfaces, `theme.layout(layout)` (`sanitizeLayout` live, its forced rules),
    `theme.slot(id, parts)` (panel parts without links or text fields, plus art, progress, lyrics line, shapes),
    `theme.navigate(page)` and `theme.action(id)` from a fixed list. Events: now playing (art as an `art:` handle),
    position (4 a second), page, window, colour scheme, and, with their permission, queue, visualizer frames, lyrics.
  - Nothing leaves: no I/O in the engine; outputs are sanitized data; theme CSS keeps `url()` to `data:` and the
    app's own `art:` local and theme pictures only (a remote `art:` URL would carry data to an allowlisted host); the
    page CSP (no remote img, font or connect) is held by a test; storage of its own, 256 KB.
  - Slices: 1 `S` older-proof first (`sanitizeTheme` keeps `script` as is, unrun; old-fixture test); 2 `M` the theme
    kind and `THEME_METHODS` in Rust (tests: every other method refused, `network:*` refused); 3 `M` the review at
    import, `.theme` drop and Sync arrival (per PC, like plugins), setting "Let themes run code", safe start (Shift
    held, or a crash at the last start) runs none; 4 `L` the UI host (`style`, `vars`, `classes`, `layout`, dropped
    when the script stops or throws; CSS `url()` rule; CSP test); 5 `M` the events; 6 `M` slots; 7 `S` the brand
    cover check (`elementFromPoint` over the brand after each change: covered, the theme's CSS and layout are dropped
    for the run, with a toast); 8 `S` navigate and actions; 9 `S` `docs/themes.md`, an example theme, i18n.
  - Backward compatible: a theme without `script` is unchanged; a newer `api` runs no code (colours, CSS and layout
    still apply, the card says it needs a newer Legato), like `LAYOUT_API`. Desktop only (rquickjs has no Android
    bindings); absent from Lite (plugins are cut).
- [x] `S-M` A theme file dropped on the app applies at once and joins My themes; a small warning only when it changes
      the layout (`askAboutLayout`, `themeLayoutImport.ts`, the drop handler in `PlayerBar.tsx`). The owner's word,
      2026-11-27: themes "dynamique et rapide", the app really user-friendly. Builder: Sonnet.
  - 2026-11-27: done. No question before applying; the message says “Theme … added” with Undo (the theme out, the pick
    and the look back). Every door (drop, import, paste, copy) goes through `withAddedTheme` (`theme.ts`): 24 themes
    at most said rather than one lost, and the same theme dropped again is picked, nothing added. Tests in
    `addTheme.test.ts`. Not tried in the app.
    - Decided alone (2026-11-27): “the same theme” is all but its id (a file differing only in font or look joins);
      a copy made in the editor leaves the user's look choices as they are (an imported theme applies its own).
- [ ] `L` Rearrange the app by dragging its parts (sidebar, player, parts of pages), saved into one's own theme (the
      layout v1 format). The owner's ask, 2026-11-27. Designed by Opus, 2026-11-27.
  - No new format: everything fits layout v1 (`LAYOUT_API` stays 1, so older themes and versions need no migration), and
    `layout.ts`' rules stay the only ones (places, hideable and fixed parts, the logo and page lists never hidden).
  - What drags: sidebar and side panel left or right, player bar top or bottom (YouTube's frames never move in the
    page), the bars' parts within their container with an eye on the hideable ones, the shown page's parts, list columns
    by their header, the page header's art, the columns' widths by a handle. Never: Settings, Add-ons, dialogs.
  - Edit mode: right-click › “Arrange the app…”, Settings › Appearance › Theme, a shortcut without a default key (turns
    `themeLayouts` back on, and says so). A bar of the app's look: Undo, Redo, Default, Discard, Done; Escape is Done.
    The draft is drawn live (`useShellLayout`); nothing is written to the settings before Done. Pointer drag
    (`shared/ui/drag.ts`), and every handle a button (Alt+arrows, Delete hides, a live region says it).
  - Saved into one's own theme: the current custom theme's `layout` rewritten, a preset or System copied first (“{name}
    custom”, the 24 cap said, nothing lost); then a toast with Undo. Phones have no edit mode. Lite has it, lazily loaded.
  - Decided alone (2026-11-27, design): Home keeps its own section order (the `look`), not the layout.
  - [x] Slice 1 `S` (2026-11-27): pure `shared/theme/arrange.ts` (`moveSurface`, `moveInGroup`, `toggleHidden`,
    `layoutFromPlacement`) and `shared/order.ts` (`moveToSlot`, the queue's now); table and round-trip tests. Nothing in
    the interface calls it yet.
  - [ ] Slice 2 `M`: edit mode (store, draft, bar, entries, history, `saveArrangement`, Undo toast), a lazy chunk.
  - [ ] Slice 3 `M`: surfaces (drop zones, keyboard, announcements).
  - [ ] Slice 4 `M`: the three bars' parts and the eye.
  - [ ] Slice 5 `M`: page parts, columns by their header, the header's choice (check the virtualized table's headers and
    a drag under Now Playing).
  - [ ] Slice 6 `S`: size handles (`sizes`).
  - [ ] Slice 7 `S`: docs (`docs/design.md` › Theme layout, the themes' help, Figma light and dark) and a line on the site.
- [x] `S` The bundled Discord Presence copy is never refreshed: an install adopted before `8bda5716` still links "Source code" to `legato-app/legato`. Re-copy the bundled files (`discord_move::FILES`, `plugin_adopt_discord` in `src-tauri/src/plugins.rs`) when the bundled manifest's version is newer than the installed one, storage kept; bump the bundled version. 2026-11-26: done at launch (`discord_move::refresh` from `start_all`, bundled 1.0.1), storage and granted permissions untouched. Not tried in the app.
  - Decided alone (2026-11-26): refreshed in `start_all`, not `plugin_adopt_discord`, which the interface stops calling once the move is done; any installed copy of that id with an older plain-number version is refreshed (the app keeps no record of who installed it), another version text is left alone; a permission a later version adds stays ungranted until approved.
- [x] `M` Plugin pictures: an optional manifest `icon` (a png in the plugin's folder, size-capped, read and checked by Rust, never fetched; an API 2 addition) on the card and the details. The author's picture only for verified authors, shipped with the app next to `crates/plugins/trusted-authors.json`; others keep the initial.
  - 2026-11-27: the icon is done (`crates/plugins/src/icon.rs`: a plain file, PNG signature and header, 256 KB and
    512 px at most; served by the `art` scheme as `plugin/<id>`). Rust tests; not tried for real (no plugin with one in
    the app yet). The author's picture is its own line below.
    - Decided alone (2026-11-27): any `api` may name one (nothing to grant); without one the card keeps its puzzle
      piece; the install question shows none (the folder isn't installed yet).
- [ ] `S` Plugin author's picture, verified authors only, shipped next to `crates/plugins/trusted-authors.json`: no
      picture file exists to ship (the owner's to give). The owner's choice, 2026-11-27: the Legato logo.
- [x] `S` Legato's signing key (the owner makes it: `pnpm tauri signer generate -w "$env:USERPROFILE\.legato\plugins.key"`), its public key in `trusted-authors.json`, Discord Presence signed (`scripts/plugin-files.mjs` + `pnpm tauri signer sign -f …`) in `examples/` and in `legato-app/discord-presence`, and `discord_move::FILES` carrying `legato.files` + `legato.files.sig`.
  - Done 2026-11-27: the public key trusted, the bundled copy signed (the owner's files), tested against the key; never
    installed in the app. Left, the owner's: sign `legato-app/discord-presence` the same way.
    - Decided alone (2026-11-27): a copy of the bundled version, manifest and script unchanged, gets the signing files
      it lacks (the version doesn't move with a signature); an edited copy is left as it is.
- [ ] `M` Theme and plugin gallery without a server: an index file in a GitHub repo, browsed from Add-ons, installed after
      2026-11-13 (wider mandate), still not built: the index has to live in a repository that does not exist yet (and the project never creates
      one on its own); a gallery that can list nothing would be a fake button. When the owner makes it: one `index.json` (name, kind, url, sha256, size), fetched through `Noted`, a download refused when its hash differs, themes through the existing theme import, plugins through `plugin_inspect` and its permission review.
      the usual permission review; authors submit by pull request.
      Skipped 2026-11-13 (night): installing means downloading code or theme files from a repository into the plugins folder, then the
      permission review: the download, its size and hash checks and the trust in the index are the owner's to set (who may publish, pinned
      commits); a first slice (read the index, list it) alone would show entries nobody can install.
- [ ] `M` Sharing: remote wormhole words (needs the user's OK on the public relay), the share import's QR code
  2026-11-13: webcam QR scanning done behind Settings › Playback › Scan QR codes with the webcam (off, this PC's own): a
  Scan with the webcam button in Add a device and Listening rooms; jsQR (Apache-2.0) loads at the first scan, the camera is
  asked for at the press and let go of when the window closes, no picture is kept or sent. Decoding is tested on a real QR
  matrix; not tried: WebView2's camera permission prompt and a real webcam. Left: the share import's QR (it reads an
  image file today), wormhole words.
- [ ] `M-L` Practice mode for musicians: A-B loop, slow down without pitch change (Live Editor has it), key and chords shown,
      count-in / metronome on the song's tempo.
      2026-11-12, the A-B loop: the player's menu has A–B loop (Loop starts here / Loop ends here / Clear the loop); at the end the
      song goes back to the start, from the position the player reports (`abLoop.ts`, no engine change, so the turn is a
      quarter of a second late on a file); it goes when another song starts. Left: chords shown (no source gives them: the key is the tag's, a column and Edit song info).
      2026-11-12, the metronome: the player's menu has "Metronome" (clicks on the audio clock at the song's tempo tag, else a typed tempo, 30 to 400
      BPM; it follows the tempo, not the song's beats; stops with another song). Decided alone (2026-11-12): no count-in (it would need to
      hold playback). Never tried by ear.
      2026-11-13, the count-in: the player's menu has "Count in, then play": the song waits (paused) while four clicks sound at its tempo
      (the tag's, else typed; at the speed it is heard, the Live Editor's included), then it plays from where it is
      (`countIn.ts`, the clicks are the metronome's). Decided alone (2026-11-13): four beats, no setting, an accent on the first; it
      holds playback by pausing, so nothing in the engine changed. Never tried by ear.
      2026-11-13, slow down: the player's menu has Practice speed (50, 75, 90 %, normal): the Live Editor's tempo, pitch kept, so the song's
      edit becomes a draft like any editor change (Reset undoes it). Decided alone (2026-11-13): four steps, no setting. Never heard.
      2026-11-12: the loop has a key (L: start, end, clear, in the shortcuts table) and a band on the progress bar. Decided
      alone (2026-11-12): L, one key cycling the three steps, rather than three keys. Never tried by ear or on a screen.
      (to check: A-B loop and practice speed landed (26af2559, abb85f55, 3e492039); key and chords not located)
- [ ] `M-L` Profiles on one PC (each person's library, likes, history and Last.fm), switched from the top bar.
      2026-11-13 (wider mandate), still skipped: the first step is not the data model but the launch (which library file, which keychain names, which WebView2 profile are chosen before the window opens), the code the CI just showed a panic in; the owner's choices above come first.
      Skipped 2026-11-13 (night, not for this run): a profile is a second library file plus its own keychain entries and its own
      WebView2 cookies, chosen before the window opens, so a switch restarts the app; it touches `identity`, `rename.rs`'s folders and
      Sync Mode's per-PC files, and a wrong first step could mix two people's data. Needs the owner's choices (what is shared, e.g. local
      folders) before the data model.
      Owner's choices (2026-11-25): shared between profiles: local folders, personal servers (Subsonic, Jellyfin, Plex), look and sound (theme, EQ, playback settings); each profile's own: library, likes, history, Last.fm, YouTube cookies (WebView2 profile), keychain entries. A profile picker at launch when there are several; a switch restarts the app. An optional 4-digit code per profile, said in the UI as a lock against mistakes, not real protection.
      The owner, 2026-11-27: after the Lite, designed by Opus first; the app opens on the last profile (no picker at
      launch, which replaces the 2026-11-25 choice), switched from the avatar menu.
  - Design (Opus, 2026-11-26):
    - No migration: today's data is the profile "Main", where it already is. `profiles.json` in `app_data_dir`:
      `[{id, uid, name, color, code?}]` plus `last`. `code` is a salted sha256 of the 4 digits, checked in Rust.
    - Another profile `<id>`: `app_data_dir/profiles/<id>/library.db`; WebView2 at
      `app_local_data_dir/profiles/<id>/EBWebView` (`data_directory` on the main window builder, `lib.rs:835`); keychain
      service `app.legato.desktop.p.<id>`. Last.fm, ListenBrainz, Discord, the Google session, plugins and the Sync device
      id follow from those three.
    - Shared: `SHARED_KEYS` (theme, EQ and playback, `localFolders`, servers) in `app_data_dir/shared.json`, laid over the
      profile's settings; server secrets stay under the Main keychain service; the art cache stays shared.
    - Switching restarts the app: `profile_switch(id)` writes `last`, then `app.restart()`. WebView2's folder is fixed at
      start, and rebuilding `AppState` live risks mixing two people's data. `--profile <id>` at start. A profile with a
      code asks for it before anything shows.
    - UI: an avatar (initial + colour) at the end of the TopBar (`App.tsx:97`). Its menu: the current profile + Manage,
      the others (switch), Add a profile, Remove (asks; the library is backed up first, then the folder and keychain
      service are deleted).
    - Sync Mode: the snapshot carries the profile `uid` and the merge refuses another `uid`; setup and pairing bind the
      current profile. Android: one profile; the switcher is desktop only.
    - Decided during the 2026-11-26 run: avatar menu first. The launch picker (the owner's 2026-11-25 choice) is NOT built
      until the owner reconfirms it, because the 2026-11-26 note said the menu may replace it. Remove deletes after a
      confirm and a backup.
    - Slices: 1 `profiles.json` + pure `profile_paths` (Main = today's paths) with tests; 2 launch uses the paths,
      `--profile`, the restart switch; 3 `SHARED_KEYS` + `shared.json` with a test; 4 Sync `uid` (field, refusal, pairing)
      with tests; 5 the avatar menu + optional code; 6 the launch picker if reconfirmed, docs (`architecture.md`,
      `sync-mode.md`, `PRIVACY`: nothing new leaves the PC).
    - Designed 2026-11-27 (Opus), not built. Replaces the slices above; the owner's choices of 2026-11-25 and 2026-11-27 hold.
      Facts from the code: settings live in the library (`lib.setting("ui")`, `lib.rs:805`, `load_settings:361`), so they
      follow the profile. Eight calls read the folders (`app_data_dir()` / `app_local_data_dir()`: lib.rs, backup x3,
      storage x2, art, diag, plugins); secrets go through `secrets::store(service, dir)` (`secrets.rs:12`); every web
      window (main `lib.rs:810`, ytm x2, spotify_export, web_reader) must take the same `data_directory`.
      - Disk: Main = today's paths, byte for byte, no migration. Another profile lives in `profiles/<id>/` (library.db,
        its daily copies, plugins, session), WebView2 in `app_local_data_dir/profiles/<id>/EBWebView`, keychain under
        `<identifier>.p.<id>`. A root `profiles.json` holds `{id, uid, name, color, code?}` and `last`. Reads are
        tolerant: unknown keys kept; a damaged file means Main plus one diag line with the id, never the name. Shared at
        the root: the diag log, the image cache, `shared.json`.
      - Shared: theme and own themes, EQ, playback settings, `localFolders`, servers, through one `SHARED_KEYS` table
        (Rust, next to `save_settings`). `shared.json` is laid over the settings at load; on save the shared keys go to
        `shared.json` *and* to the profile's settings, so each library stays complete and an older version, or a
        rollback, opens Main intact. Server secrets are read under Main's service (`SharedSecrets` routes `server:*`).
        Each profile scans its own shared local folders (tracks are rows of its library).
      - Launch: `--profile <id>`, else `last`, else Main (unknown id = Main). One helper `profile::dirs(app)` replaces
        the eight calls; a test reading the sources forbids `app_data_dir()` and `WebviewWindowBuilder::new` outside the
        helpers, so no forgotten window opens another person's Google session (the one real risk of mixing). The
        single-instance guard (`lib.rs:748`): a second launch for another profile asks the running one to switch. The
        Run entry and updates are unchanged (they start on `last`). The `rename.rs` catch-up concerns Main only.
      - 4-digit code: salted sha256 in `profiles.json`, checked in Rust (`profile_unlock`). A lock screen in the app's
        look shows first; library commands refuse until unlocked. The UI calls it "a lock against mistakes, not protection".
      - UI: an avatar (initial + colour) at the end of the top bar, after Settings (`App.tsx:202`). Hidden while there is
        one profile; then only "Add a profile" exists, in the account menu and in Settings › General. Its menu: the
        current profile (rename, colour, code), the others (switch: toast "Switching to X…", playback stops, restart),
        Add, Manage. Remove asks, backs up the library, then deletes the folder, the known keychain keys
        (`KNOWN_SECRET_KEYS`, since keyring cannot list) and the WebView2 folder. Main and the open profile are never removed.
      - Sync Mode: the snapshot carries `profile` = uid (`serde(default)` = Main's uid, so older files go to Main); the
        merge refuses another uid with a notice. Profiles other than Main sync in `Legato Sync/<uid>/`, so an older
        version sees only Main's files at the root. Pairing over the network binds the open profile.
      - Bound to a profile (say so in the docs): the remote, the overlay, Last.fm, ListenBrainz, Discord, Google,
        installed plugins. A paired phone is paired to one profile.
      - Lite: the same design under its own identifier (`app.legato.lite`: its own profiles, never the full app's).
        Plugins are off there. Cost: one JSON read at launch. Android (full and Lite): Main only, no avatar or menu,
        `profiles.json` never read (`#[cfg(desktop)]`).
      - Slices (S = 1, M = 2; each with tests and i18n in 17 locales), 11 points, order 1 to 6; 1 and 3 can run in parallel:
        1 `M` `crates/core/src/profiles.rs`, pure: tolerant read and write of `Profiles`, `ProfilePaths` (Main = today),
          `hash_code` / `check_code`. Tests: no file gives Main, a damaged fixture, unknown keys kept, Main's paths unchanged.
        2 `M` Launch: `profile::dirs` at the eight calls, one helper for every web window, `--profile`, `profile_switch`
          (writes `last`, then `app.restart()`), single-instance, the source-reading test. First check: WebView2 accepts
          another folder at each launch, and all windows of one launch share it.
        3 `M` `SHARED_KEYS`, `shared.json`, `SharedSecrets`. Tests: the overlay, the round trip, and a full profile
          library that an older version would read.
        4 `M` Sync: uid, refusal, subfolder, pairing. Tests: an old fixture without uid gives Main; another uid is refused.
        5 `M` Avatar and menu, add and manage, the code lock (`profile_unlock`, command guard). Tests: menu entries (pure),
          the code in Rust, commands refused while locked.
        6 `S` Removal (a pure plan of what gets deleted, tested); docs: architecture, `sync-mode.md`, design (Figma light
          and dark), the site's `PRIVACY` (nothing new leaves the PC).
      - To decide alone when built: plugins per profile (their storage may be personal); Main never removable; avatar
        without a photo; Main's default name "Me" through `tr`, renamable.
      - Not verified: nothing run. The WebView2 rule "one folder per launch" and `app.restart()` with an argument are to
        confirm in slice 2.
- [ ] `L` Exclusive WASAPI output / bit-perfect for local files (foobar's audiophiles).
- [ ] `L` Podcasts by RSS (open feeds only: no platform audio taken), resume per episode, speed.
      2026-11-13, the first slice: Settings › Playback › Podcasts (off) adds Podcasts to the app menu: type an open feed's address, keep
      the show with its heart, play its episodes (`connectors/podcast.rs`: the feed read by hand, no XML crate, mockito tests;
      the audio is a ranged GET through the engine like a server song, `server:podcast:<address>`). Episodes of 20 minutes and more
      resume as any long song does; speed is the Live Editor's. Decided alone (2026-11-13): no directory search, no new-episode
      check, no downloads (a download is a copy of the audio; streaming only), no sidebar entry. 2026-11-13, second slice: Refresh on a show (reads the feed again; episodes not there the last time it was opened say New), played marks (a button per episode; starting one marks it; this PC only), OPML import (the exported text pasted; shows kept, no request made). 2026-11-13, third slice: Copy the list as OPML (clipboard). 2026-11-13, the background check: Settings › General › Check podcasts (off) reads each kept feed every six hours while the app is open (a minute after launch, 1.5 s between feeds, 30 shows at most, `podcasts/check.ts`) and a notice counts the new episodes; nothing is marked seen. The site's Podcasts privacy row says so. Never run for real. Never tried on a real feed or by ear; the privacy row says the feed host is reached.
      (to check: podcasts with a six-hour check exist (2a5fdc01, 688a575c); resume per episode and speed not located)
- [ ] `L` Living-room mode: big UI driven by a gamepad or the arrow keys (10-foot layout), for a PC on a TV.
      2026-11-13, first slice: Settings › General › Living-room mode (off, this PC only): the page zoom is 150 % at least, the focus ring
      thick, the arrows move between the visible controls (`livingRoom/spatial.ts`, nearest in that direction; inside the open dialog),
      Enter presses a focused non-button, Esc goes back. Decided alone (2026-11-13): arrows and Enter/Esc only. Never seen on a TV. 2026-11-13, second slice: a gamepad (Gamepad API, standard layout, polled while the mode is on): d-pad or left stick moves, A presses, B goes back (`pad.ts`). Never held a pad.
      Left:
      a purpose-built home screen, the player bar enlarged beyond the zoom, on-screen keyboard for search.
      2026-11-13, third slice: an on-screen keyboard (Enter in a text field in the mode opens a grid of keys at the bottom, walked with the arrows or a pad; letters, digits, a few marks, space, delete, Done, Enter; lazy `livingRoom/OnScreenKeyboard.tsx`). 2026-11-13, fourth slice: a TV home (Settings › General › TV home, off by default; with the mode on, big tiles to Search, Songs, Albums, Artists, Mixes, Radio, Podcasts and Audiobooks when on, Settings; opens when the mode turns on, and in the app menu; lazy `livingRoom/TvHome.tsx`). Decided alone (2026-11-13): plain tiles, no cover rows, easy to replace by the owner's design. Never seen on a TV.
      2026-11-18 (lot 60): found that the TV home (fourth slice, `ac4ab854`) already is the dedicated home screen; added its Up next row (the next 6 queue songs as big tiles, a press plays that one; pure `tvQueue.ts`, tested). Left: the player bar enlarged beyond the zoom. Never seen on a TV; the arrows reach the new tiles through the existing `nextBox` map (not run for real). Decided alone (2026-11-18): no second focus-map function (`spatial.ts` `nextBox` already handles rows and edges, tested), the bar left alone (it needs a look on a real TV).
      (to check: the TV home landed (ac4ab854, af01e735, c5c829df); gamepad input not located)
- [ ] `L` Media panel off Windows.

## Visualizer v2 (user's ask 2026-10-30: more realistic, more detailed)

First cut on Stable since 1.1 (`docs/playback.md`): 1/6-octave bands at 60 Hz from both twins, one canvas in a worker
drawn at 30 fps, eight looks (LED, Bars, Mirror, Peaks, Wave, Radial, VU needles, Spectrogram), the strip under the cover
and full screen on V. The lines left are in no milestone yet. Sorted like the features; both twins stay alike (`crates/dsp`
and `live.js`), and a look waits for the data it needs. Each look has a few settings: bands, smoothing, peak hold,
colours, mirror, reflection.

**High**

**Medium**

**Low**

## Workflow (how we build it)

- [ ] `L` Code quality: the same code written again and again, merged into shared helpers (the owner, 2026-11-26:
  « les IA ont tendance à refaire un peu le même code de partout… faut vraiment bosser sur la code quality »).
  - Audit first (Opus, read-only): clusters of near-duplicate code in `ui/src` and `crates/` + `src-tauri/src`
    (same fetch-and-cache, list sorting and filtering, menu entries, time and number formatting, settings rows,
    error-to-notice mapping, Rust row readers, HTTP client setup…), each with its files, the shared helper it would
    become (an existing one first), the lines it would remove, and its risk. Ranked by lines saved over risk.
  - Then slices, one cluster per commit, behaviour unchanged, covered by the existing tests plus one for the helper;
    the biggest savings first. No new dependency for it.
  - [x] A. Settings switches: 65 rows say `toggle`, `SettingToggle` reads and writes the setting (2026-11-27,
    126 lines fewer; settings pages not seen in the app).
  - [x] B. `shared/stored.ts` for what this PC remembers: 15 files read and write through it, their own guards and
    cuts kept (2026-11-27, 160 lines fewer, 44 added).
  - [x] C. `web_reader.rs`: Apple Music's and Spotify's page readers are one (`Site`), each file keeping its inbox and
    commands (2026-11-27, 329 lines out, 292 in; no real account read, the e2e Apple fixtures not run).
  - [x] D. `add/pageRead.tsx`: the rules, sign-in, reading and picking steps both connect buttons share (2026-11-27,
    157 lines out, 158 in; no real connection tried).
  - [x] E. `app/notifyError.ts` for error toasts: 42 call sites (2026-11-27; the error banner calls left as they were).
  - [x] 6. `Library::setting_as` / `set_setting_as` for typed settings: 19 reads and 7 writes (2026-11-27; 26 long
    lines made short, 20 added with the test).
  - [ ] 7. Queue entries in the right-click menus: tried and left (2026-11-27): a shared builder saved 7 lines in
    `menus.tsx` for 30 added, and `menuItems.test.ts` reads each item id from the source, which a builder hides.
  - [x] 8. `app/copyText.ts` for the clipboard: 6 files (2026-11-27; 25 lines out, 24 in, one helper); a refused
    clipboard now says why in the remote, Sync Mode and Up next, which were silent. Rooms keeps its banner error,
    the "Copied" buttons their own state.
  - [ ] 9. The sidebar entries: tried and left (2026-11-27): one table of words and icons added 39 lines for 25
    removed (`Sidebar.tsx`, `PhoneTabs.tsx`).
  - [x] 10. `escapeRegExp` and `fold` in `shared/format.ts`: three regex escapes and the settings search's own
    folding gone (2026-11-27, tests only).
    - Decided alone (2026-11-27): the settings search folds as the other searches do (NFKD, marks dropped), so a
      full-width letter typed there now matches too.
  - [x] 11. The "Copied" button: `app/CopyField.tsx` for sharing and the Spotify wizard, Rooms through `copyText`
    (2026-11-27, tests only).
    - Decided alone (2026-11-27): the wizard’s button now comes back to "Copy" after 1.5 s and takes the app’s button
      look; a refused clipboard is a toast in the three places (Rooms showed its banner); the theme and diagnostics
      copy buttons keep their own.
  - [ ] 12. The small equality helpers: left (2026-11-27): the same one-line list comparison exists twice
    (`libraryPatch.ts`, the player store); a shared one with its test adds more than it removes.
  - [ ] 13. The FNV hashing: left (2026-11-27): three copies of 1 to 4 lines (`banner.ts`, `filter.ts`,
    `smart/rules.ts`), `connectors/src/art.rs` the only Rust one; a helper with its test adds more than it removes.

Today: every green push to master is a Beta prerelease (479 commits so far, check 5-11 min then release 10-16 min) and
Stable goes out by hand (`promote`); the smoke test runs on every push; `src-tauri/src/lib.rs` 2149 lines; CLAUDE.md
~15 kB read by every session.

Most useful first; the tag is the effort.

- [ ] `M` The "Check live in the real app" list as a scripted checklist (a dev-only page that drives each step and logs the
      result), so a pass takes minutes, not a session.
- [ ] `S` Faster CI: run the macOS job only on pushes that touch Rust or `src-tauri`, `cargo nextest`, `sccache`; Linux
      job stays crates only.
      2026-11-13, skipped (can't be run here): skipping macOS needs a changed-files step in the matrix, and `release.yml`
      waits for `check` to succeed, so a skipped job must still count as green; nextest leaves doctests out of `pnpm check`
      (a second `cargo test --doc` step); sccache with rust-cache can cache twice. Each wants one try on a branch's CI.
      2026-11-18 (lot 55), the macOS skip only, NOT run (no CI here, YAML parsed only): `check.yml` › `check` gets a `scope` step
      (bash) after the checkout: on macOS it diffs the push's `before` (or the pull request's base) against HEAD and sets
      `run=false` when nothing under `crates/`, `src-tauri/`, `Cargo.toml|lock`, `rust-toolchain*` or the workflow itself
      changed; every later step carries `steps.scope.outputs.run != 'false'`, so the job still ends green (the release waits
      for `check` to SUCCEED: skipped steps are a success, the job is not skipped) and costs about a minute. Windows and
      Linux always run everything. It runs everything when the base is unknown (new branch, all-zero `before`, a failed
      fetch). What could break it: a base commit GitHub no longer serves (then it runs everything, by design), a step I
      gated wrongly (all 12 steps but the checkout and the scope are gated, read in the diff). Not done: nextest, sccache (they
      need a CI try each). Decided alone (2026-11-18): macOS only, Windows keeps the whole check (it is the release's gate);
      a front-end-only change is trusted on macOS because the same vitest and types run on Windows. Easiest undo: revert.
- [ ] `S` `graphify hook install` (the user's go) so the graph stays fresh without asking; then drop the `.gitattributes`
      line it adds (the graph isn't tracked).

## Optimisation (how it runs)

Most useful first; the tag is the effort.

- [ ] `S` YouTube embeds: measure what the second (hidden) embed costs, only if the owner's CPU or memory points at it.
      Already so: one embed plays a whole run of YouTube songs (`loadVideoById`); a second exists only for an overlap
      (two songs sound at once) or to hold Next's video cued (`cueNext`, 5 s into each song: Next is instant, the overlap
      takes it); stopped when idle (`stopVideo`); both gone when a song of another source plays.
      Decided alone (2026-11-18, lot 58): unloading the idle one not built. It is idle only seconds before `cueNext` reuses
      it, so a 20–30 s unload would almost never fire, or would undo the cued Next; recreated, its video never starts in
      the tray's hidden page (`overlap`, `holdPage`), the risk of a silent overlap. The CPU likely comes from the playing
      embed and its live chain, not a stopped one: unproven, to measure with the Task Manager before touching it.

## Check live in the real app (built and unit-tested, never driven for real)

- [ ] Ajouter depuis une sauvegarde, with the settings box and without it (`7d32c78d`, `7723f222`, `f467e661`, `8dbf6d6e`): the 37 shared settings come back, the 935 songs stay out.
- [ ] A new Lite joining an existing sync takes the others' settings without overwriting them (`bc5c271d`, the Lite sync fix).
- [ ] Resuming a stopped sync keeps this PC's settings (`40060f24`).
- [ ] A swapped title turned the right way round after a merge (`f0ef47ba`), e.g. « like that - doja cat *slowed* ».
- [ ] Connect Spotify on the phone: « Open Exportify » opens the phone's browser, then the saved file is taken (`d93f0c82`).
- [ ] Right-click customising screen (tick, reorder, Reset per kind, 4a6ba10c, MenuCustomize.tsx): not driven in the
      app.
- [ ] Adaptive Sound as one steady gain per song, from its integrated loudness (4173b567, c74d9eb9, bdd3e3ba, 362dd86b):
      the owner's phone and PC, not tried for real.
- [ ] A video-only title saved swapped, then turned by a sync from an older PC (a273ab9f, e80a2ca4): two real PCs, not
      tried.
- [ ] Android crackle gone: a YouTube song on the phone, Bluetooth earphones, screen off or app in background, crossfade
      and 8D each on (fixes 390e82fe, 306de9a3, c0245823).
- [ ] Connect Apple Music on the owner's account (the owner's ask to keep it in mind, 2026-10-31): All Playlists read with
      covers, a long library playlist and Favorite Songs read to their end, the `media-user-token` cookie ending the
      sign-in step, a second import updating the lists. If it breaks, `apple.js`'s selectors are the first suspect (only a
      public playlist page was seen).
- [ ] YouTube Music every 15 minutes: offered after a Google sign-in, runs while the app is open, silent on a refusal.
- [ ] A Legato link between two PCs: its videos come in named, no search.
- [ ] A SoundCloud song link pasted, and an `on.soundcloud.com` short link from SoundCloud's phone app: named, found on
      YouTube, added; a set's link says why it can't.
- [ ] Settings › General › Back up your library, then Restore a backup: the app restarts on it, playlists and history
      as saved, `library-before-restore.db` beside the library.
- [ ] A folder and a few songs dropped from Explorer: the folder in Settings › Accounts › Local files, the songs in the
      library after a restart, the notice's Play; songs already there play at once; a QR picture still opens a shared list.
- [ ] Start radio from an album, a playlist and the artist page, signed in to YouTube and signed out: its own songs one
      in three, Up next naming the radio, more songs coming at its end with autoplay off.
- [ ] The search bar's pages, actions and settings: "shuffle", "dark", "stats", Enter on each, in French too.
- [ ] Headphones unplugged, then a Bluetooth headset turned off, each while a song plays (YouTube, a local file): paused
      at once, the notice's Play goes on; with the setting off it plays on through the speakers.
- [ ] Windows' default output switched by hand while a local file plays, then while it's paused: it goes on (or waits)
      on the new device at the same place.
- [ ] Shuffle a playlist of a few artists: no artist twice in a row in Up next, the songs played today at the end.
- [ ] Mixes page at an hour you listened at on the same weekday two weeks running: "Your Friday evenings", in French too.
- [ ] A Teams test call with Pause during calls on, a song playing: paused as it starts, plays on as it ends. Also with
      Windows' Communications set to Do nothing (does Windows still say it?), and a call on another device.
- [ ] An album played from its first song with a fade set: no dip between its songs (YouTube Music album and local
      files), a playlist of singles still fades, the sleep timer's last song still fades out.
- [ ] "No sound could be taken" gone from the second YouTube video on (fix 51946d5).
- [ ] A real update from 0.1 (user's PC): Legato installed, old folder and its shortcuts gone, library, sign-ins and Open
      at startup still there.
- [ ] A real network cut (Wi-Fi off while a YouTube song starts): paused, one message, restarts on its own. Only emulated
      so far (DevTools cuts the page, not YouTube's out-of-process frame).
- [ ] Add to a YouTube Music playlist from an album page (cause of `STATUS_FAILED` assumed = duplicates); toasts + Undo
      / Add anyway; advanced fade by ear (curves, fade on skip, fade on pause); Home's YouTube Music shelves on a real
      account (unofficial API); Home items not in the library; new mixes after real listening; exact restore after an
      update.
- [ ] Tray menu actions, media keys on a real keyboard, add to a YouTube playlist the user owns, blocked video falling
      back, Auto on a real music video, resume after a real restart, sort Most played.
- [ ] Repeat one / repeat all at a track's end, menu actions that write (rename, delete, export, remove from playlist),
      local file covers, Apple cover backfill, Spotify covers, add another Google account, sign out.
- [ ] Landed the night of 2026-10-31, on Stable since 1.1, never seen on a real screen: Deezer and Apple links through the
      paste box (a real `link.deezer.com` short link too: tested on a recorded 302 only), Shift + wheel on a real mouse and
      the volume number, SponsorBlock turned on (a real intro skipped, Undo, marks on the progress bar), Skip silence across
      real crossfades, Karaoke on plain lyrics, with animations off, over a video in the watch page and at 60 fps on a long
      song (bench PC), a 10 000-song scroll asking only 64 px covers.
- [ ] One Liked Music (the owner's report, 2026-11-01: two in the sidebar after a Spotify import): yours, where imported
      likes wait for the YouTube account (its like refused here that day: 403), folded into the account's on every page
      (`features/library/likedMusic.ts`, the store's `raw` keeps both for the heart button and Remove from). Check: one
      entry in the sidebar, Home and search, the waiting songs on top of it, unliking one of them, a sync moving them over.
- [ ] A YouTube song that stayed black and silent until skipped away and back (the owner's report, 2026-11-01). Cause:
      Google's "Sorry…" page answers the embed's player request (403, after about 7 s) while it limits this PC's address,
      a third of the starts for hours after an import's 1840 searches (`diagnostics.log`: "YouTube refused searches | 125
      refused, 1715 answered"). `crates/shield/src/refused.js` tells the app at once: loaded again once (`playback` log:
      "Google refused the video, loading it again"); refused again, stopped with "Too many requests", nothing blocked, no
      watch page, no other upload searched. The clock waits for a new song's first report (it ran, nothing playing). The
      stuck check stays for slow networks (26 s). Check when it happens again: the log line, the song on about 8 s in.
      Imports now search one at a time, 3 s apart, and wait 5 min on a refusal (`searchpace::Pace`, the owner's call: an
      import of 1840 searches takes about 1.5 h instead of 30 min). Check on a real import: no `YouTube refused searches`
      line, playback fine meanwhile. Still fast: a pasted song list (6 at a time, `songlist.rs`) and Find versions (150 in
      a row, stops at the first refusal).
- [ ] The 2026-11-02 run (Beta 1.1.588), checked only by tests and over the demo:
      - Phone remote on a real phone (Settings › Playback): the QR code, the page, taps; Windows' firewall asks once.
      - OBS overlay in a real Browser Source; Settings › Privacy's real log of the day.
      - Pick up on the other PC (two PCs with Sync Mode): the toast once, then Resume in the idle player bar.
      - Cover display (C) on a real second screen; the display kept awake (WebView2's wake lock).
      - Share as a picture: a real paste into a chat app, a real save as PNG / JPEG.
      - Visualizer weighting and colour, by eye on real music (defaults unchanged); the cover's colour on real covers.
      - Library health page on the real library; Exportify's real names on a real export; the phone layout (a window
        under 640 px). Back to {month} shows only with months of history.
- [ ] The 2026-11-04 and 05 runs (the Beta of 2026-11-05), checked only by tests and over the demo:
      - Picture-in-picture (P) in the real window: small and above the others, dragged, back to a maximized or full
        screen one; a YouTube video in it; two screens.
      - The search on the real library: the order of your songs, a typo fixed, typing at 50 000 songs.
      - The alarm's real ring (from the tray, the PC awake or asleep); voice commands with real speech.
      - The taskbar's Jump List of an installed build; the recap's real save and copy; real tagged files (genre, year).
      - The accent from real covers; the Presets look with a real .milk file; "In the lyrics" on a real lyrics cache.
      - The phone's update on a real phone (from the Beta after 1.1.679): the toast, the download on mobile data and
        Wi-Fi, Android's permission page, its installer, the new version starting where the old one was.
- [ ] Against Liner (2026-11-05 on), checked only by tests and over the demo:
      - Keep the screen on (Settings › Playback › Screen): past Windows' screen timeout while a song plays, asleep as
        usual once paused; on the phone too (does Android's WebView grant the lock?).
      - The phone's interface (U1) on a real phone, light and dark: a long press and every ⋯ open a sheet, Android's
        Back closes it (and a dialog sheet) before leaving the page; the sheets and Now Playing clear the gesture bar
        and the notch (safe-area insets); the keyboard over a dialog sheet (a playlist's name) leaves its buttons
        reachable; every icon button answers a thumb's tap at its edge; Settings › More settings opens and a settings
        search opens the right fold; the mini player opens Now Playing on a tap, its heart and play don't. Judge the fold
        list and the moved controls (Reset history, previous only in Now Playing).
      - Glow and simplicity (U2): Settings › Appearance › Player › Glow at Off, Soft and Strong, in a dark and a light
        theme: the play button, the playing row's mark, the seek bar's played part, a switch that's on, the sung line,
        Now Playing's cover on a few real covers (a grey one: no glow); Off leaves nothing. More glow without too much?
        Does a song change stay smooth with Now Playing open (Task Manager's GPU column)? The player bar's More (picture
        in picture, sleep timer…), Now Playing's More (Karaoke, Cover display, Less like this), the moon back while a
        sleep timer runs, Back / Forward appearing once you've moved, Your library's Expand and Sort under the pointer.
        Judge the calmer look: anything missed is one class to put back.
      - Listening rooms (17, local half), a PC and the phone on the same Wi-Fi: the room shows in Join a room within
        3 s on both sides; the code and the QR join (a wrong code says so; 5 of them change the code); the listener
        starts the song within a few seconds and stays within 1.5 s of the host (pause, seek, next on the host); a
        song only on the host's disk is found on YouTube on the listener's side, or says "Can't find this song here";
        own pause and Catch up; skip on the listener says it follows the room; reactions float on both; End room and
        Leave; the host closing the app ends the room on the listener ("The room's host left"). Windows' firewall asks on
        the first room (TCP 47823): does a refused prompt leave a clear error? Android in the background: does the room
        keep up with the screen off? Settings › Privacy lists nothing new (no host is talked to).
      - Your music server (personal servers, part 1), with your own Navidrome (`docs/development.md` › Your music
        server): Sign in with its address, user and password (a wrong password says so; an address that isn't a server
        says so; a public http:// address shows the warning); the first sync brings its songs, albums and playlists
        (how long for your library? does the app stay responsive?); a song plays, seeks forward and back, hands over to
        the next without a gap, the Live Editor and the visualizer work on it; its cover shows; a like stars it in
        Navidrome and an unlike unstars it; a song played past half shows in Navidrome's recently played (and only
        then); Wi-Fi cut mid-song: it picks up or says "stopped sending"; an opus or other unusual file plays (the
        server's MP3); Sign out takes its songs away; Settings › Privacy lists the server's address. On the phone over
        Wi-Fi: the same song plays and seeks.
      - Jellyfin (personal servers, part 2), with your own (`docs/development.md` › Jellyfin and Plex): Server type
        Jellyfin, its address, user and password (a wrong password says so; a Jellyfin older than 10.9 says so; an Emby
        or a web page says it isn't a Jellyfin); Dashboard › Devices shows "Legato on Windows"; songs, albums,
        playlists and favourites come in; a song plays and seeks (a FLAC raw, an opus as the server's MP3); a like is a
        heart in Jellyfin, an unlike removes it; Dashboard › Activity shows the start and the stop; a song played past
        half adds to its play count (and one skipped early doesn't; one played to its end counts once, not twice:
        Jellyfin's own Stopped may count a play past 90 %, then `UserPlayedItems` adds one); Sign out removes the device
        from Jellyfin's list and the songs from the library.
      - Plex (personal servers, part 2), with your Plex account and server: Server type Plex › Sign in with Plex
        opens app.plex.tv in your browser with the code shown in the app; after you allow Legato there, the app goes on
        by itself within a few seconds (several servers: a picker; a shared one says "Shared with you"); Cancel stops
        it; a code left alone expires with a message. Songs and playlists come in (how long for your library?), covers
        show, a song plays and seeks; a like is 5 stars in Plex, an unlike clears them; a song played past half shows
        in Plex's history; away from home (phone on mobile data, or the server's port closed) does the row say Plex's
        relay, and does it play? Back home, the next sync leaves the relay by itself. Does `/identity` answer without a
        token (the sign-in finds the server)? Settings › Privacy lists plex.tv, the server's plex.direct address,
        nothing else.
      - The phone's fixes from your tries (2026-11-06, reviewed the same evening): Back from a playlist goes to the
        page before, at the root the app goes behind and the music goes on; Back closes a sheet, a dialog, the lists' i
        box, the visualizer, Karaoke and Now Playing first. A YouTube song outside Now Playing: no video over the lists,
        the sound on, Now Playing shows the video. The app opened on a Wi-Fi with no internet (a hotspot without data),
        a YouTube song played: Now Playing says "Can't reach YouTube…" with Try again, never the error page; the song
        isn't skipped, and plays by itself once the internet is back. (The internet lost mid-song with the Wi-Fi still
        up is another path, untouched: does it skip?)
      - Against Liner 3 to 5 and the round covers (2026-11-06 evening, Beta 1.1.750 by the dry run). Discord, Song and
        artist: "Listening to jinx – lexycat", the album under it; a YouTube song played 10 s shows the artist's small
        picture on the cover's corner, on a friend's screen too. Settings › General › Picture-in-picture on minimize:
        the title bar's minimize, Win+Down, a taskbar click and Win+M while a song plays open the small window (does
        the window show going down first?); that one minimized and restored from the taskbar gives the full window
        back; the sung line under the picture. Settings › General › Storage: do the sizes look right, does Clear on
        Lyrics and song analyses and on Diagnostics log free them (how long on your library?), is WebView2's size
        there? The radial look, and vinyl covers, on a YouTube upload with a 16:9 picture: round, the ring around it.
      - The 2026-11-07 work (the night's Beta: Against Liner 7, 9, 10 and the lyrics on the backdrop; then the
        autonomous run's local commits, not pushed yet: 13, 14, the website). Stats › Recap's last card, "My music
        profile": its numbers, top artists and playlists right, the saved picture. An import with doubtful matches: its
        end lists them, the videos side by side; a pick sticks, Approve all keeps the rest. Next 10 s into a YouTube
        song: quicker than before? (Copy diagnostics: the "time to sound" lines.) Now Playing's lyrics readable on a
        light cover? A big playlist's import (yours to run): the lists there at once, a song not looked up yet found as
        it comes up to play, the import screen's count going down; does YouTube refuse sooner than before? A song from
        your Navidrome or Jellyfin that has lyrics: the server's own first; the lyrics' source line › Other lyrics: the
        choices with their %, a pick kept after a restart and after the caches are cleared, Let Legato choose. The
        website once deployed: the story on your phone in the phone's layout; /legato/fr/ in French, the header's
        language picker.

## Waiting on the user (outside the code)

- [ ] Lite sync of 2026-11-28: the full app's UI settings were replaced by the Lite's defaults (fix on the way); restore
      them from the daily library copy (steps in the owner's private notes).
The owner's answers (2026-11-07, a quiz over the open questions; the lines they changed say so). Kept as they are: on
the phone a YouTube song plays out of sight outside Now Playing, SponsorBlock off by default, the volume curve, star
ratings in the library only (not in the files' tags), imports at one search per 3 s, no checking of every YouTube
video ahead, no Spotify previews, Android as the APK with its own updates (no Play Store).

- [ ] Plex's Terms of Service (plex.tv › About › Privacy & Legal): the page refused an automated read (2026-11-06), so
      nothing in them was checked. Sign in with Plex follows the PIN flow developer.plex.tv documents for apps, on the
      user's own server; whether Plex's terms say more about third-party apps is your read. Also your call: trying
      it with your account (`docs/development.md` › Jellyfin and Plex).

- [ ] Discord shows "Listening to Music App": that's the name of the app on Discord's developer portal (rename it there).
- [ ] Trademark search for Legato (INPI, EUIPO, USPTO classes 9, 41, 42).
- [ ] Figma: muted text (ink3) light is #606060 in the app (AA on cover tints), #6B6B6B in the file. Rename the file
      "Legato · Design" (the plugin can't rename files).
- [ ] Spotify: try Ctrl+A, Ctrl+C on a private playlist in the desktop app and paste into Notepad (links, one per line?).
- [ ] Spotify: ask for the data export (Privacy settings › Download your data); its `Playlist1.json` is the test file:
      open the ZIP in Add music › Connect Spotify › Open Spotify's data export (are private playlists in it?).
- [ ] A playlist file from foobar2000 / VLC / MusicBee, and an `iTunes Music Library.xml`, through Add music.
      (to check: a190d0fd reads iTunes and MusicBee library playlists; foobar2000 and VLC not located)
- [ ] Quit the installed Legato from the tray and open it again: a session closed its hidden single-instance window by
      mistake on 2026-10-31.

## Not done yet

**Spotify** (no keys; the user chose link import)
- [ ] Keep or remove the Spotify app-key path (Settings › Accounts). User's call.
- [ ] Only if the user asks: ad blocking (ToS / account risk first).
- [ ] Needs paid accounts: MusicKit (Apple Developer).

**Housekeeping**
- [ ] Playlist `trackCount` vs rows mismatch (Workout Mix).
- [ ] "Music App export test" playlist on YouTube Music: ask before deleting.
- Dependabot alert #1 (`glib` 0.18, Linux only, through Tauri's GTK3 stack) dismissed: re-check at each Tauri upgrade.

## Fixed limits

- Never download or extract YouTube or Spotify audio. Hidden player: only Now Playing's Cover mode, the user's choice
  (2026-10-16) against YouTube's terms; everywhere else the video stays visible (minimum 200×200).
  2026-11-18, the owner's choice, also against those terms (the phone's since 2026-11-06): a YouTube video shows only in Now Playing, or in the mini player when that is on (off by default); no longer forced on screen elsewhere (`miniRule.ts`).
- No circumventing Premium or DRM. Quotas respected, no server of ours.

## Left open (what the ticked lines still leave)
- [ ] `S` Visualizer style previews: they use the visualizer's own painter (`VizThumb.tsx`), not the real sound.
- [x] `S` Remove from a playlist: check it on YouTube Music and server playlists too (only local ones were checked).
  - 2026-11-27: checked in the code and with mocks, not tried for real. YouTube Music sends `browse/edit_playlist` with
    each row’s `setVideoId` (Liked Music: `like/removelike`); Subsonic sends `updatePlaylist` `songIndexToRemove`;
    Jellyfin and Plex playlists are read-only (the menu entry is off). Fixed on the way: rows without a `setVideoId`
    (another account’s playlist) counted as removed, so the next account was not tried and the sync brought the song
    back.
    - Decided alone (2026-11-27): such an answer is a refusal (put back here, said). Assumption: YouTube Music gives
      `setVideoId` only for playlists the account can change.
    - 2026-11-27 (review): an account that finds nothing no longer ends the search; the next ones are tried
      (`remove_from_owner`). Nothing found and no failure still counts as removed.
- [x] `S` Crossfade: check that a refused embed (or the crossfade's other player) never keeps sounding once the watch page takes over.
  - 2026-11-27: checked in the code, tested with fake reports, not tried for real. The refused embed was covered
    (paused on the switch, paused again if it plays: `embedReport`). The other embed was not: a stop sent while its
    video starts is ignored by YouTube (a stale cue swapped by a quick Next), and nothing stopped it after
    (`tailReport` now does). Fixed too: after a Google refusal, Play loaded the video into the embed while the watch
    page played it. The watch page's own webview was not checked.
    - Decided alone (2026-11-27): an overlap's old song still finishes its fade out when the next one goes to the watch
      page (bounded by its end; that is the crossfade).
    - 2026-11-27 (review): the other embed's report is answered only when its frame is still the tail (`answerTail`, by
      frame key): a late one could stop or fade the new tail.
- [ ] `S` A video refused before, reached by an overlap or by Next into the cued embed with Now Playing closed: no embed
      is bound yet, so `videoRect()` finds no place and another upload plays instead of its watch page (read in
      `playOnWatchPage`, not reproduced).
- [ ] `S` Share page: no covers and no player yet (covers would load from YouTube's host for the visitor).
- [x] `S` Stats recap cards. Ticked 2026-11-18 (lot 63, audit of the line): the recap shipped (`812a8d96` a year or a month as cards to share, `d725d9fe` the profile card; `features/stats/RecapView.tsx`, `recapCards.ts`, `recapDraw.ts`, tested in `recap.test.ts`). What the line still asked is a try by hand (the card from the web page, the QR's look and size): Check live.
- [x] `M` Whole-app security pass (for Opus): read-only pass done 2026-11-28, fixes landed; details in the owner's private notes. Not tried for real.
- [ ] `S` Signed-out YouTube search: check it on the owner's PC; if it still fails, read the error under the search.
- [ ] `S` Settings labels: review the descriptions' length and read the labels in the app in every language; the JSX per group is optional.
- [x] `S` Server songs levelled: Jellyfin's `NormalizationGain` and Plex's loudness (other scales).
  2026-11-19 (night run): Jellyfin done: `Jellyfin::replay_gain` reads `NormalizationGain` / `AlbumNormalizationGain` from `/Users/{id}/Items/{item}` (dB, -60..60, anything else none) into the same ReplayGain path as Subsonic's (`Conn::replay_gain`, `servers.rs` `gains`), tested with mockito. Assumption (not checked on a real server): the gain is to ReplayGain's -18 LUFS, as jellyfin-web's default target says; the server only has values after its LUFS scan. Left: Plex (its loudness attributes are not read: no documentation found, needs a real server).
  - Brief: Plex gain from the stream's gain values (confirm in the Plex documentation first) into the ReplayGain path, with the same range guard as Jellyfin's; mock tests.
  2026-11-27: Plex done: `Plex::replay_gain` reads the audio stream of `/library/metadata/<id>` into the same path, with
  Jellyfin's range guard; tested with mockito, not tried for real.
  - Decided alone (2026-11-27): the stream's `loudness` and `peak`, not its `gain` / `albumGain`: python-plexapi's
    reference gives the attribute names, nothing found says what Plex's gains bring a song to. Assumption (not checked on
    a real server): `loudness` is integrated LUFS, so the gain is -18 - loudness. No album gain: Album levelling uses
    the song's own.
  - [ ] `S` Plex album gain: read `albumGain` once a real server shows what it is relative to.
- [x] `S` Discovery: covers from the Cover Art Archive (one more host) are not done. Done: `79492349` (an option, off by default).
- [ ] `S` Streamed songs: genre, year and tempo are not filled (no source gives them without a new host).
- [ ] `S` Last.fm "Discoveries": left for the owner (its public API has changed).
- [ ] `S` Internet radio: a phone tab, and the station's own metadata (no ICY).
  2026-11-18 (lot 63): the phone tab is done: Radio is the 5th bottom tab (`PhoneTabs.tsx`, the lit tab chosen by the pure `tabLogic.ts`, tested), since the sidebar that holds Radio is hidden on a phone. Untried on a phone (5 tabs at 375 px). Left: the station's own metadata (ICY, a stream read: needs a real station).
- [ ] `S` Focus / workout sessions: the session itself (timer, no-lyrics filter, summary) is left.
      (to check: the focus timer is in the app (ee7973a3, 611dc3b0, 768cc172 mention it); the no-lyrics filter and the
      summary not located)
  Audit 2026-11-18 (lot 63): the timer (the sleep timer's fade) and the summary ("N songs in M min") already shipped in `player/focus.ts`; only the no-lyrics filter is left, and no library field says a song has lyrics (they are fetched per song), so it needs a data source first: the owner's call.
- [ ] `S` Smart playlists from words: the LLM half, with the user's own key, is left for the owner (a service and a privacy row to decide).
- [x] `M` Blind test: left out, the artist-only guess, the answer timer, several players (local or LAN), a game from one playlist.
  2026-11-27: all four parts are in (local players pass the device round); LAN play is its own line below. Not tried for real. Fixed: a playlist with fewer than 8 askable songs said “your library”.
    Decided alone (2026-11-27): LAN play is left out: each device would need the same rounds, the turns and the scores in step, so a sync design first. One key per player was not added: turns cover local play.
  2026-11-19 (morning): several players on one device are done: a list of 1 to 4 players in the game's header, the rounds go round them (`players.ts`: `playerOf`, `scored`, `leaders`, tested), each round says whose turn it is, the end lists every player's score with the leader(s) in bold; a timed-out round scores nothing. Left: players on several devices (LAN or the internet: a network and a protocol, for the owner). Decided alone: pass-and-play only, no player names ("Player 1…"), changing the number restarts the game. Never played in the app.
  2026-11-19 (night run): a game from one playlist (the playlist menu's "Blind test from this playlist…", `openBlind(pool)`) and the artist-only guess (a chip "Guess the artist" restarts the game with four artists as answers, `pickRounds(…, 'artist')`, fewer than 8 artists = no artist game) are done, tested. Left: several players (local or LAN: a game's rules and a network, for the owner). Never played in the app.
  2026-11-18 (lot 63), the answer timer: a round now lasts 30 s from the start of its snippet (`ANSWER_MS` = the 20 s snippet + 10 s); with no answer by then it ends, shows the song and scores nothing, and a thin line along the answers runs out (`blind-clock`, a transform). Pure `pointFor` / `TIMED_OUT`, tested. Decided alone (2026-11-18): no speed bonus (taste), no new text (the existing "It was …" line is the reveal); easiest undo: remove the effect in `BlindTest.tsx`. Never played in the app. Left: the artist-only guess, several players, a game from one playlist.
  2026-11-27: the time to answer is a choice in the game's header (10, 20, 30 or 60 s, `ANSWER_SECONDS`); at 0 the answer shows, as before. Not tried for real. Decided alone (2026-11-27): 30 stays the start, the choice is not saved, changing it restarts the game, and it still counts from the round's start (a short one includes the song's loading).
  2026-11-27 (review): the clock bar restarts with every new game, and the seconds follow plural rules (Arabic: a wording right for any number).
- [ ] `M` Blind test on several devices (LAN): rounds, turns and scores in step between them; a sync design first.
- [x] `S` Typed `invoke` wrappers: the argument names and types are not checked by a test yet. Done 2026-11-18: `ui/src/shared/apiCommands.test.ts` reads `shared/api.ts` and every `.rs` under `src-tauri/src`, and fails when an `invoke('<cmd>', { … })` names a command that is not in `generate_handler!` or not defined by a `#[tauri::command]` fn, passes a key that command's parameters do not take (Rust snake_case read as Tauri's camelCase; `State`, `AppHandle`, `Window`, `WebviewWindow` left out, `Channel` kept) or leaves out a required one (an `Option` may be omitted); and when `generate_handler!` registers a name no command defines. Names and keys only, no types (ts-rs owns those). It found NO mismatch: the 279 wrappers all agree with the 280-odd commands today (checked that it can fail: a renamed key in `ytmArtist` is reported, then restored). No other file calls `invoke` outside tests. NOT done: the types of the arguments and the answers. References read: `ui/src/shared/api.ts`, `src-tauri/src/lib.rs` (`generate_handler!`), the command signatures under `src-tauri/src` (State and AppHandle parameters, `Option` ones).
- [x] `S` Library scan progress: a small `M` with its own Channel, not started. Done 2026-11-18 (small): the Local files section of Settings › Accounts (`SourcesView.tsx`) now shows "Reading your files… {done} of {total}" with a thin bar under its folders while a scan runs, from the SAME report the Songs page already follows (`scan-progress`, `useScan`, sent by `rescan` every 200 ms at most; the text already exists in the 19 locales, nothing to translate). Found while reading: the progress already existed as an app-wide event, fired by every scan (the rescan button, adding or removing a folder, the folder watcher, a drop), and Songs showed it; only Settings did not. Decided alone (2026-11-18): NOT a new `tauri::ipc::Channel` on `rescan` / `rescan_local` as the line said: a Channel serves only the call that opened it, so the watcher's and a drop's scans would stay silent and the same count would be sent twice; the event reaches every window part that wants it, which is what both screens need. NOT seen on screen: the demo emits no scan progress, so the bar was checked by `tsc` and lint only, not by eye; `progressOf` and the store keep their existing test. References read: `src-tauri/src/library_cmd.rs` (`rescan`), `ui/src/features/library/scanProgress.ts` (+ test), `LibraryView.tsx:285-302`, `SourcesView.tsx` (Local files), `viz.rs` (`viz_start`, the Channel prior art).
- [ ] `S` Hide explicit songs: untried on real answers (YouTube Music's page rows give no flag).
      (to check: 6bef82c0 marks explicit songs from YouTube Music's E badge, Exportify and iTunes; this line says the
      rows give no flag: which is current?)

### Personal servers (what is left)
- [ ] `S` Plex's Sign out ends nothing at Plex: the account's token is dropped at the pick, and an owned server's
  token can be the account's own; Legato stays in plex.tv › Authorized Devices until the user removes it there
  (the privacy row says so). Revoking it needs the account token kept, or a documented device-removal call.
  Skipped 2026-11-11 (decided alone): the repo knows no documented removal call (developer.plex.tv's API reference has
  none for a device; the one clients use, `DELETE plex.tv/devices/<id>.xml`, is the legacy undocumented one), and
  it needs the account token, which is dropped at the pick on purpose (only the server's own token is kept). Keeping
  the account token longer widens what a keychain leak gives: not for a call we can't check. The privacy row already
  tells the user to remove the device at plex.tv.
- [ ] `S` Plex's JWT sign-in (clients.plex.tv, a device key pair, the token refreshed each week) if Plex retires
  the legacy PIN's long-lived tokens.
- [ ] `S` Your music server in the app's search (`Conn::search` built for the three kinds, not wired). Decided alone
      (checked 2026-11-28: jellyfin.rs:300, plex.rs:483 and subsonic.rs:362 have search; src-tauri/src/catalog_search.rs
      does not call them)
  (2026-11-06): left for later; the library mirrors the whole server at each sync, so its songs already come
  up in the library's own search; the server's search would only add what came since the last sync.
  Skipped 2026-11-11 (decided alone): nothing a user would see beyond that gap (songs added in the last 30 minutes),
  while wiring costs a server request per search on every account and a "not in your library" result kind that
  plays without being in the library. Revisit if a sync gets slower than 30 minutes.
- [x] `S` Playlist edits sent back to the server (`updatePlaylist`, `createPlaylist`) when its direction sends.
  2026-11-11: a Subsonic server's playlists take songs (Add to playlist, a drop on the sidebar) and lose them
  (Remove from) from here, sent with `updatePlaylist` in the background and undone here when refused; a
  removal reads the server's list first (it removes by position). 2026-11-13: `createPlaylist` too (a playlist made
  here: menu "Send to <server>", every song must be that server's, then it is mirrored from that server and the
  next sync finds it by its id). 2026-11-19: renames too (Rename… on a Subsonic playlist whose direction sends:
  `rename_imported` here, `updatePlaylist` with `name` in the background, the old name back and `serverRename`'s text
  when refused). Left: order, Jellyfin and Plex (read-only, said in words). Untried on a real server: mock tests only.
  - Brief: Jellyfin playlist add and remove (read the entries first, as the Subsonic path does), mock tests as in `jellyfin.rs`.
  2026-11-27: checked, nothing left to wire: adding, removing, creating and renaming are all sent only when the
  server’s direction sends (`pushes()`), mockito tests pass, the privacy row already says it. No new host. Not tried for
  real (no real server).
  Decided alone (2026-11-27): ticked on that; reordering has its own line below, Jellyfin and Plex stay read-only.
- [ ] `S` Reordering a music server’s playlist from here: imported playlists can’t be reordered in the app yet, so there
  is no order to send.
